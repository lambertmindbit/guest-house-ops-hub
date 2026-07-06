"""Owner-console tools — read-only operations for the property owner.

These back the owner_agent (distinct from the guest agent): the owner asks about
their day and their queue, and these fetch the answer from the PMS seam. All
reads; no writes in this slice. Owner-only data, so they go through the same
token-gated seam as every other tool.
"""

from __future__ import annotations

from typing import Any

from google.adk.tools.tool_context import ToolContext

from ..services.ota_client import OtaClient, OtaError

_client = OtaClient()


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
