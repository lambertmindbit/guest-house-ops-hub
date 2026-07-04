"""Agent tools — the guest booking assistant's read tools (Phase 2).

Each tool calls the PMS seam through OtaClient (never a DB directly), appends any
generative-UI card to tool_context.state["_ui"], and returns a compact JSON
summary for the LLM to reason over. This mirrors the reference tenant_2_agent's
tools, rewired to OUR endpoints and params (docs/AGENT-GENUI-PLAN.md).

Write/booking tools are Phase 3 — deliberately absent here so this agent can only
read (it cannot create a booking yet).
"""

from __future__ import annotations

import re
from typing import Any

from google.adk.tools.tool_context import ToolContext

from ..services.ota_client import OtaClient, OtaError
from ..services import ui

_client = OtaClient()


def _push_ui(tool_context: ToolContext, component: dict[str, Any]) -> None:
    # Re-ASSIGN the whole list (not an in-place append): ADK records state changes
    # as deltas keyed by __setitem__, so an in-place mutation of a nested list is
    # not tracked and would never reach the session the server drains.
    bucket = list(tool_context.state.get("_ui", []))
    bucket.append(component)
    tool_context.state["_ui"] = bucket


async def check_availability(tool_context: ToolContext, check_in: str, check_out: str) -> dict[str, Any]:
    """Show which rooms are free for a stay and their nightly rate.

    Args:
        check_in: check-in date, YYYY-MM-DD
        check_out: check-out date, YYYY-MM-DD (must be after check_in)
    """
    try:
        free = await _availability_with_rates(check_in, check_out)
    except OtaError as e:
        return {"status": "error", "message": str(e)}

    if not free:
        return {"status": "success", "available_count": 0, "message": f"No rooms are free for {check_in} to {check_out}."}

    _push_ui(tool_context, ui.rooms_component(free, check_in, check_out))
    return {
        "status": "success",
        "available_count": len(free),
        "rooms": [{"id": r["id"], "label": r["label"], "type": r["roomTypeName"], "rate": r["rate"]} for r in free],
    }


async def quote_room(tool_context: ToolContext, room_id: str, check_in: str, check_out: str) -> dict[str, Any]:
    """Quote the price of a specific room for a stay and show a price card.

    Args:
        room_id: the PMS room id (from check_availability)
        check_in: YYYY-MM-DD
        check_out: YYYY-MM-DD
    """
    try:
        catalog = {r["id"]: r for r in await _client.rooms()}
        room = catalog.get(room_id)
        if not room:
            return {"status": "error", "message": "That room could not be found; check availability again."}
        quote = await _client.quote(room_id, check_in, check_out)
    except OtaError as e:
        return {"status": "error", "message": str(e)}

    nights = len(quote.get("nights", []))
    total = quote.get("total", 0)
    _push_ui(tool_context, ui.quote_component(room, check_in, check_out, nights, total))
    return {"status": "success", "total": total, "nights": nights, "currency": "INR"}


# ── Booking flow (Phase 3): propose → OTP → finalize ────────────────────────
# A booking is NEVER written until finalize_booking, which goes through
# POST /api/agent/reservations — the same guarded path the owner uses, so the
# GiST no-double-booking constraint governs it (a 409 → RoomJustTaken). Guest OTP
# is DEMO mode: the code is generated here and echoed on screen (real WhatsApp
# delivery is the flagged BSP follow-up). The pending booking + code live in
# session state, not the model, so exact details/codes aren't LLM-transcribed.


def _valid_range(check_in: str, check_out: str) -> bool:
    return bool(re.match(r"^\d{4}-\d{2}-\d{2}$", check_in or "")) and bool(re.match(r"^\d{4}-\d{2}-\d{2}$", check_out or "")) and check_out > check_in


async def propose_booking(
    tool_context: ToolContext, room_id: str, check_in: str, check_out: str, guest_name: str, guest_phone: str
) -> dict[str, Any]:
    """Show a booking-confirmation card for the guest to review. Does NOT book.

    Args:
        room_id: PMS room id (from check_availability)
        check_in: YYYY-MM-DD
        check_out: YYYY-MM-DD
        guest_name: the guest's name
        guest_phone: the guest's phone (10 digits)
    """
    phone = re.sub(r"\D", "", guest_phone or "")
    if len(phone) != 10:
        return {"status": "error", "message": "I need a valid 10-digit phone number to hold the booking."}
    if not _valid_range(check_in, check_out):
        return {"status": "error", "message": "Please give a valid check-in and check-out date (YYYY-MM-DD)."}
    try:
        catalog = await _client.rooms()
        # Accept either the cuid id (from a room-card Book button) or the human
        # label like "201" (from natural language).
        room = next((r for r in catalog if r["id"] == room_id or r["label"] == room_id), None)
        if not room:
            return {"status": "error", "message": "That room isn't available; let's check availability again."}
        real_id = room["id"]
        quote = await _client.quote(real_id, check_in, check_out)
    except OtaError as e:
        return {"status": "error", "message": str(e)}

    nights = len(quote.get("nights", []))
    total = quote.get("total", 0)
    tool_context.state["_pending"] = {
        "roomId": real_id, "roomLabel": room["label"], "roomTypeName": room["roomTypeName"],
        "checkIn": check_in, "checkOut": check_out, "nights": nights, "total": total,
        "guestName": guest_name.strip(), "guestPhone": phone,
    }
    _push_ui(tool_context, ui.confirm_component(room, check_in, check_out, nights, total, guest_name.strip(), phone))
    return {"status": "proposed", "total": total, "nights": nights, "message": "Show the confirmation card and wait for the guest to confirm."}


# NOTE: the /confirm (send OTP) and /otp (verify + write) steps are handled
# deterministically in server.py — they're button actions, not conversation, so
# they don't spend an LLM turn (more reliable, and easy on the free-tier quota).
# finalize goes through POST /api/agent/reservations (the guarded, GiST-checked
# path); a 409 becomes a "just taken" message.


async def _availability_with_rates(check_in: str, check_out: str) -> list[dict[str, Any]]:
    """Free rooms enriched with rate/occupancy from the catalog (one call each)."""
    avail = await _client.room_availability(check_in, check_out)
    catalog = {r["id"]: r for r in await _client.rooms()}
    free: list[dict[str, Any]] = []
    for a in avail:
        if not a.get("free"):
            continue
        cat = catalog.get(a["id"], {})
        free.append(
            {
                "id": a["id"],
                "label": a["label"],
                "roomTypeName": a["roomTypeName"],
                "rate": cat.get("baseRate", 0),
                "maxOccupancy": cat.get("maxOccupancy", 0),
            }
        )
    return free
