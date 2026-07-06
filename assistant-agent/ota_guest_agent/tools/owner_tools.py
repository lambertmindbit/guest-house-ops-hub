"""Owner-console tools — read-only operations for the property owner.

These back the owner_agent (distinct from the guest agent): the owner asks about
their day and their queue, and these fetch the answer from the PMS seam. All
reads; no writes in this slice. Owner-only data, so they go through the same
token-gated seam as every other tool.
"""

from __future__ import annotations

import re
from typing import Any

from google.adk.tools.tool_context import ToolContext

from ..services.ota_client import OtaClient, OtaError

_client = OtaClient()


def _valid_range(start: str, end: str) -> bool:
    d = r"^\d{4}-\d{2}-\d{2}$"
    return bool(re.match(d, start or "")) and bool(re.match(d, end or "")) and end > start


async def daily_briefing(tool_context: ToolContext) -> dict[str, Any]:
    """The owner's daily briefing: occupancy % right now, today's check-ins and
    check-outs, who is in-house tonight, and arrivals over the next 7 days. Call
    this for questions like "how's today looking?", "who's arriving?",
    "what's my occupancy?", "any check-outs today?"."""
    try:
        summary = await _client.owner_summary()
    except OtaError as e:
        return {"status": "error", "message": str(e)}
    return {"status": "success", "summary": summary}


async def open_requests(tool_context: ToolContext) -> dict[str, Any]:
    """The owner's open queue of things needing attention: booking requests from
    the public chat, complaints, and anything an agent handed off. Call this for
    "any booking requests?", "what needs my attention?", "any complaints?"."""
    try:
        queue = await _client.owner_escalations()
    except OtaError as e:
        return {"status": "error", "message": str(e)}
    return {"status": "success", "queue": queue}


async def block_room(
    tool_context: ToolContext, room: str, start_date: str, end_date: str, reason: str = ""
) -> dict[str, Any]:
    """Block a room so it's held / unavailable for a date range — maintenance,
    repairs, personal use, or a hold. This is NOT a guest booking.

    Confirm the room, dates and reason with the owner before calling this.

    Args:
        room: the room label (e.g. "201") or its id
        start_date: first blocked night, YYYY-MM-DD
        end_date: end of the block, YYYY-MM-DD (exclusive; must be after start_date)
        reason: why it's blocked (e.g. "repairs") — optional
    """
    if not _valid_range(start_date, end_date):
        return {"status": "error", "message": "Give a valid start and end date (YYYY-MM-DD), end after start."}
    try:
        catalog = await _client.rooms()
        match = next((r for r in catalog if r["id"] == room or r["label"] == room), None)
        if not match:
            return {"status": "error", "message": f"I couldn't find a room called {room}."}
        result = await _client.create_block({
            "roomId": match["id"], "startDate": start_date, "endDate": end_date,
            "reason": reason.strip() or None,
        })
    except OtaError as e:
        return {"status": "error", "message": str(e)}
    return {"status": "success", "block": result}
