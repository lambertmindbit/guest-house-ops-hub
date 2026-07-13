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
from ..services import ui

_client = OtaClient()


def _valid_range(start: str, end: str) -> bool:
    d = r"^\d{4}-\d{2}-\d{2}$"
    return bool(re.match(d, start or "")) and bool(re.match(d, end or "")) and end > start


def _push_ui(tool_context: ToolContext, component: dict[str, Any]) -> None:
    # Re-ASSIGN the whole list: ADK tracks state as deltas keyed by __setitem__, so
    # an in-place append to a nested list is never persisted (same rule as the guest
    # tools — a card built with .append() silently never reaches the client).
    bucket = list(tool_context.state.get("_ui", []))
    bucket.append(component)
    tool_context.state["_ui"] = bucket


def _rupees(n: Any) -> str:
    try:
        return f"₹{round(float(n)):,}"
    except (TypeError, ValueError):
        return "₹0"


def _pct(n: Any) -> str:
    try:
        return f"{round(float(n))}%"
    except (TypeError, ValueError):
        return "—"


async def daily_briefing(tool_context: ToolContext) -> dict[str, Any]:
    """The owner's daily briefing: occupancy % right now, today's check-ins and
    check-outs, who is in-house tonight, and arrivals over the next 7 days. Call
    this for questions like "how's today looking?", "who's arriving?",
    "what's my occupancy?", "any check-outs today?"."""
    try:
        summary = await _client.owner_summary()
    except OtaError as e:
        return {"status": "error", "message": str(e)}

    counts = summary.get("counts") or {}
    occupied = summary.get("occupiedRooms", 0)
    total = summary.get("totalRooms", 0)
    _push_ui(
        tool_context,
        ui.metrics_component(
            title="Today",
            subtitle=summary.get("date"),
            tiles=[
                {"label": "Occupancy", "value": _pct(summary.get("occupancyPct")),
                 "context": f"{occupied} of {total} rooms"},
                {"label": "Checking in", "value": str(counts.get("checkInsToday", 0))},
                {"label": "Checking out", "value": str(counts.get("checkOutsToday", 0))},
                {"label": "In house", "value": str(counts.get("inHouse", 0)),
                 "context": f"{counts.get('arrivalsNext7', 0)} arriving in 7 days"},
            ],
        ),
    )
    return {
        "status": "success",
        "summary": summary,
        "note": "A Today card with these numbers is already shown. Summarise what stands out — do NOT re-list every figure.",
    }


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


async def resolve_request(
    tool_context: ToolContext, request_id: str, action: str = "resolved", note: str = ""
) -> dict[str, Any]:
    """Act on a queue item from open_requests — mark it resolved, dismissed, or
    started (in_progress). Get the request_id from open_requests first, and
    confirm which item with the owner before acting.

    Args:
        request_id: the id of the queue item (from open_requests)
        action: "resolved" (default), "dismissed", or "in_progress"
        note: optional note on how it was handled
    """
    status_map = {"resolved": "resolved", "resolve": "resolved",
                  "dismissed": "dismissed", "dismiss": "dismissed",
                  "in_progress": "in_progress", "start": "in_progress"}
    status = status_map.get(action.strip().lower())
    if not status:
        return {"status": "error", "message": "Action must be resolve, dismiss, or start."}
    body: dict[str, Any] = {"status": status}
    if note.strip():
        body["resolutionNote"] = note.strip()
    try:
        result = await _client.act_on_escalation(request_id, body)
    except OtaError as e:
        return {"status": "error", "message": str(e)}
    return {"status": "success", "request": result}


async def business_summary(tool_context: ToolContext, from_date: str = "", to_date: str = "") -> dict[str, Any]:
    """Revenue and performance for a period: gross/net revenue, money collected vs
    outstanding, net profit, occupancy %, ADR, RevPAR, and earnings by channel.
    Call this for "how's revenue this month?", "what's my occupancy / ADR?",
    "which channel earns the most?", "how are we doing this month?".

    Args:
        from_date: start of the period, YYYY-MM-DD (optional; omit for this month)
        to_date: end of the period, YYYY-MM-DD, exclusive (optional; omit for this month)
    """
    if bool(from_date) != bool(to_date):
        return {"status": "error", "message": "Give both a start and end date, or neither (for this month)."}
    try:
        summary = await _client.owner_finance(from_date, to_date)
    except OtaError as e:
        return {"status": "error", "message": str(e)}

    revenue = summary.get("revenue") or {}
    period = f"{summary.get('from', '')} → {summary.get('to', '')}"
    _push_ui(
        tool_context,
        ui.metrics_component(
            title="Revenue & performance",
            subtitle=period,
            tiles=[
                {"label": "Gross revenue", "value": _rupees(revenue.get("gross"))},
                {"label": "Net profit", "value": _rupees(summary.get("netProfit")),
                 "context": "after commission & expenses", "tone": "good"},
                {"label": "Occupancy", "value": _pct(summary.get("occupancyPct"))},
                {"label": "ADR", "value": _rupees(summary.get("adr")), "context": "avg nightly rate"},
                {"label": "Collected", "value": _rupees(revenue.get("collected"))},
                {"label": "Outstanding", "value": _rupees(revenue.get("outstanding")),
                 "tone": "warn" if float(revenue.get("outstanding") or 0) > 0 else "default"},
            ],
        ),
    )

    # Where the money actually came from. Only worth a chart when there's more than
    # one channel to compare — a single bar tells the owner nothing.
    by_channel = [c for c in (summary.get("byChannel") or []) if float(c.get("gross") or 0) > 0]
    if len(by_channel) > 1:
        by_channel.sort(key=lambda c: float(c.get("gross") or 0), reverse=True)
        _push_ui(
            tool_context,
            ui.chart_component(
                title="Revenue by channel",
                subtitle=period,
                value_prefix="₹",
                points=[
                    {"label": c.get("channel", "—"), "value": round(float(c.get("gross") or 0))}
                    for c in by_channel[:8]
                ],
            ),
        )

    return {
        "status": "success",
        "summary": summary,
        "note": (
            "Cards with these numbers are already shown"
            + (" (including a revenue-by-channel chart)" if len(by_channel) > 1 else "")
            + ". Give a SHORT read of what stands out — do NOT re-list every figure."
        ),
    }
