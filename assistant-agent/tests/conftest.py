"""Test fixtures for the agent sidecar.

The whole point of this suite: exercise the DETERMINISTIC core (the /book,
/bookdetails, /quote, /confirm slash-flows and the empty-turn retry chain) with
NO network and NO LLM, so it runs in CI in seconds without any API key. The
seam (`server._ota`) is replaced with an in-memory fake; the LLM runners are
faked per-test where a conversational turn is under test.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Import the app with the env it expects present (values are never used — the
# seam is faked — but OtaClient reads them at construction time).
os.environ.setdefault("OTA_BASE_URL", "http://test.invalid")
os.environ.setdefault("OTA_AGENT_TOKEN", "test-seam-token")
os.environ.setdefault("OTA_CHANNEL_ID", "test-channel")
# /chat now fails closed without a token; post_chat sends this by default so
# tests authenticate. The auth tests override it or pass token=None explicitly.
os.environ.setdefault("ASSISTANT_AGENT_TOKEN", "test-agent-token")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ota_guest_agent import server  # noqa: E402
from ota_guest_agent.services.ota_client import OtaError, RoomJustTaken  # noqa: E402


DEFAULT_ROOMS = [
    {
        "id": "r201", "label": "201", "roomTypeId": "t-deluxe", "roomTypeName": "Deluxe", "maxOccupancy": 3, "baseRate": 3500,
        "photos": ["https://example.com/r201-a.jpg", "https://example.com/r201-b.jpg"],
        "facing": "East", "view": "Pool view", "amenities": ["AC", "WiFi"],
    },
    {"id": "r101", "label": "101", "roomTypeId": "t-std", "roomTypeName": "Standard Double", "maxOccupancy": 2, "baseRate": 2500},
]


class FakeOta:
    """In-memory stand-in for OtaClient. Knobs let a test simulate a room that
    got taken (free=False) or a write that loses the GiST race (conflict=True)."""

    def __init__(self):
        self.channel_id = "test-channel"
        self.rooms_data = list(DEFAULT_ROOMS)
        self.free = True            # what room_availability reports
        self.conflict = False       # create_reservation raises RoomJustTaken
        self.escalation_fails = False  # create_escalation raises OtaError (transient)
        self.created_reservations: list[dict] = []
        self.created_escalations: list[dict] = []
        self.logged_turns: list[dict] = []

    async def rooms(self):
        return self.rooms_data

    async def room_availability(self, check_in, check_out, room_ids=None):
        ids = room_ids or [r["id"] for r in self.rooms_data]
        return [{"id": i, "label": i, "roomTypeName": "x", "free": self.free} for i in ids]

    async def quote(self, room_id, check_in, check_out):
        return {"nights": [{"date": check_in}, {"date": check_out}], "total": 7000}

    async def create_reservation(self, body):
        if self.conflict:
            raise RoomJustTaken()
        res = {"id": f"res-{len(self.created_reservations) + 1}", **body}
        self.created_reservations.append(res)
        return res

    async def create_escalation(self, body):
        if self.escalation_fails:
            raise OtaError("simulated transient failure")
        esc = {"id": f"esc-{len(self.created_escalations) + 1}", **body}
        self.created_escalations.append(esc)
        return esc

    async def log_turn(self, body):
        self.logged_turns.append(body)
        return {"id": f"turn-{len(self.logged_turns)}"}


@pytest.fixture
def fake_ota(monkeypatch):
    fake = FakeOta()
    monkeypatch.setattr(server, "_ota", fake)
    return fake


_DEFAULT_TOKEN = object()  # sentinel: "caller didn't specify" vs explicit None


async def post_chat(message: str, session_id: str, mode: str = "public", token=_DEFAULT_TOKEN):
    """Drive POST /chat and return the parsed list of StreamChunk dicts."""
    import json
    import httpx

    # Default: send the configured token so the request authenticates. An explicit
    # token=None means "send no header" (the missing-token auth test).
    if token is _DEFAULT_TOKEN:
        token = os.environ.get("ASSISTANT_AGENT_TOKEN")
    headers = {"content-type": "application/json"}
    if token is not None:
        headers["authorization"] = f"Bearer {token}"
    transport = httpx.ASGITransport(app=server.api)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/chat", headers=headers,
            json={"message": message, "sessionId": session_id, "mode": mode},
        )
    if resp.status_code != 200:
        return resp.status_code, []
    chunks = [json.loads(line) for line in resp.text.splitlines() if line.strip()]
    return 200, chunks


def texts(chunks):
    return [c["delta"] for c in chunks if c.get("type") == "text"]


def cards(chunks):
    return [c["component"]["type"] for c in chunks if c.get("type") == "ui"]
