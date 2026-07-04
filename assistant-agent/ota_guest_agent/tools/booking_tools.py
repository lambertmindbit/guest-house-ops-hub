"""Agent tools — the guest booking assistant's read tools (Phase 2).

Each tool calls the PMS seam through OtaClient (never a DB directly), appends any
generative-UI card to tool_context.state["_ui"], and returns a compact JSON
summary for the LLM to reason over. This mirrors the reference tenant_2_agent's
tools, rewired to OUR endpoints and params (docs/AGENT-GENUI-PLAN.md).

Write/booking tools are Phase 3 — deliberately absent here so this agent can only
read (it cannot create a booking yet).
"""

from __future__ import annotations

from typing import Any

from google.adk.tools.tool_context import ToolContext

from ..services.ota_client import OtaClient, OtaError
from ..services import ui

_client = OtaClient()


def _push_ui(tool_context: ToolContext, component: dict[str, Any]) -> None:
    bucket = tool_context.state.setdefault("_ui", [])
    bucket.append(component)


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
