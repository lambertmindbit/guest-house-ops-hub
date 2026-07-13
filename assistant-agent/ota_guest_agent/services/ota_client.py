"""Typed async client for the PMS agent seam (/api/agent/*).

This is the ONLY file that knows the OTA app's URLs. Every tool calls the PMS
through here, so the agent holds no booking state of its own and the GiST
no-double-booking guarantee governs every write (Phase 3). Read endpoints used in
Phase 2: rooms catalog, per-room availability, price quote.

Config comes from the environment (see .env.example):
  OTA_BASE_URL     e.g. https://guest-house-ops-hub.vercel.app
  OTA_AGENT_TOKEN  the same secret as the OTA app's AGENT_TOKEN
"""

from __future__ import annotations

import os
from typing import Any

import httpx


class OtaError(Exception):
    """Raised when the seam returns a non-2xx (except 409, surfaced explicitly)."""


class RoomJustTaken(Exception):
    """POST /api/agent/reservations returned 409 — the room was booked first."""


class OtaClient:
    def __init__(self, base_url: str | None = None, token: str | None = None, timeout: float = 15.0) -> None:
        self.base_url = (base_url or os.environ["OTA_BASE_URL"]).rstrip("/")
        self.token = token or os.environ["OTA_AGENT_TOKEN"]
        # The "Assistant (ROOT)" channel a booking is attributed to. Required for
        # create_reservation; read here so the tool doesn't have to know it.
        self.channel_id = os.environ.get("OTA_CHANNEL_ID", "")
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        # Mirror src/lib/agent-auth.ts: x-agent-token (Authorization Bearer also works).
        return {"x-agent-token": self.token}

    async def _get(self, path: str, params: dict[str, Any]) -> Any:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                res = await client.get(f"{self.base_url}{path}", params=params, headers=self._headers())
        except httpx.RequestError as e:
            # Timeout / connection failure — surface as OtaError so tools handle it
            # gracefully instead of the raw exception crashing the turn.
            raise OtaError(f"GET {path} could not reach the app ({e.__class__.__name__}).") from e
        if res.status_code == 401:
            raise OtaError("Unauthorized — OTA_AGENT_TOKEN does not match the OTA app.")
        if res.status_code >= 400:
            raise OtaError(f"GET {path} -> {res.status_code}: {res.text[:200]}")
        return res.json().get("data")

    async def _post(self, path: str, body: dict[str, Any]) -> Any:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                res = await client.post(f"{self.base_url}{path}", json=body, headers=self._headers())
        except httpx.RequestError as e:
            raise OtaError(f"POST {path} could not reach the app ({e.__class__.__name__}).") from e
        if res.status_code == 409:
            raise RoomJustTaken()
        if res.status_code == 401:
            raise OtaError("Unauthorized — OTA_AGENT_TOKEN does not match the OTA app.")
        if res.status_code >= 400:
            raise OtaError(f"POST {path} -> {res.status_code}: {res.text[:200]}")
        return res.json().get("data")

    # ── Read tools (Phase 2) ────────────────────────────────────────────────
    async def rooms(self) -> list[dict[str, Any]]:
        """GET /api/agent/rooms — catalog: id, label, roomTypeId, roomTypeName, maxOccupancy,
        baseRate, photos, facing, view, amenities."""
        return await self._get("/api/agent/rooms", {})

    async def room_availability(self, check_in: str, check_out: str, room_ids: list[str] | None = None) -> list[dict[str, Any]]:
        """GET /api/agent/rooms/availability — per-room free/busy for [check_in, check_out)."""
        params: dict[str, Any] = {"checkIn": check_in, "checkOut": check_out}
        if room_ids:
            params["roomIds"] = ",".join(room_ids)
        return await self._get("/api/agent/rooms/availability", params)

    async def quote(self, room_id: str, check_in: str, check_out: str) -> dict[str, Any]:
        """GET /api/agent/quote — advisory price for a room + date range."""
        return await self._get("/api/agent/quote", {"roomId": room_id, "checkIn": check_in, "checkOut": check_out})

    async def faqs(self) -> list[dict[str, Any]]:
        """GET /api/agent/faq — owner-managed FAQ (active), as question/answer/category."""
        return await self._get("/api/agent/faq", {})

    async def policies(self) -> list[dict[str, Any]]:
        """GET /api/agent/policies — owner-editable assistant guidance (active),
        as {intent, instructions}. Injected into the prompt per turn."""
        return await self._get("/api/agent/policies", {})

    # ── Owner console reads (owner-only; behind the same agent token) ─────────
    async def owner_summary(self) -> dict[str, Any]:
        """GET /api/agent/owner/summary — daily briefing: occupancy, today's
        arrivals/departures, in-house, and arrivals over the next 7 days."""
        return await self._get("/api/agent/owner/summary", {})

    async def owner_escalations(self) -> dict[str, Any]:
        """GET /api/agent/owner/escalations — the owner's open HITL queue
        (booking requests, complaints, agent hand-offs) still needing action."""
        return await self._get("/api/agent/owner/escalations", {})

    async def create_block(self, body: dict[str, Any]) -> dict[str, Any]:
        """POST /api/agent/owner/blocks — block a room (maintenance / hold) for
        a [startDate, endDate) range. roomId must be the real id."""
        return await self._post("/api/agent/owner/blocks", body)

    async def act_on_escalation(self, escalation_id: str, body: dict[str, Any]) -> dict[str, Any]:
        """POST /api/agent/owner/escalations/{id} — resolve / dismiss / start a
        queue item, with an optional note."""
        return await self._post(f"/api/agent/owner/escalations/{escalation_id}", body)

    async def owner_finance(self, from_date: str = "", to_date: str = "") -> dict[str, Any]:
        """GET /api/agent/owner/finance — revenue, net profit, per-channel
        earnings and performance (occupancy, ADR, RevPAR). Defaults to the
        current month when from/to are omitted."""
        params: dict[str, Any] = {}
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date
        return await self._get("/api/agent/owner/finance", params)

    # ── Write / HITL tools (Phase 3+; here for the ota_client to be complete) ─
    async def create_reservation(self, body: dict[str, Any]) -> dict[str, Any]:
        """POST /api/agent/reservations — the guarded booking path (GiST 409 → RoomJustTaken)."""
        return await self._post("/api/agent/reservations", body)

    async def create_escalation(self, body: dict[str, Any]) -> dict[str, Any]:
        """POST /api/agent/escalations — file a HITL ticket for the owner."""
        return await self._post("/api/agent/escalations", body)

    async def log_message(self, body: dict[str, Any]) -> dict[str, Any]:
        """POST /api/agent/messages — record an outbound message in the CRM thread."""
        return await self._post("/api/agent/messages", body)

    async def log_turn(self, body: dict[str, Any]) -> dict[str, Any]:
        """POST /api/agent/turns — record one conversation turn for the owner's
        chat log. Best-effort; callers ignore failures."""
        return await self._post("/api/agent/turns", body)
