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


async def list_rooms(tool_context: ToolContext, guests: int = 0) -> dict[str, Any]:
    """Show the property's rooms — with photos — WITHOUT needing dates. Use this
    when someone wants to browse ("show me the rooms", "what rooms do you have",
    "any photos?", "a room for 4") before they've given a check-in/check-out.
    For date-specific availability use check_availability instead.

    Args:
        guests: how many people, if mentioned (e.g. "a room for 4"). Only rooms
            that fit are shown. Pass 0 if not mentioned.
    """
    try:
        rooms = await _client.rooms()
    except OtaError as e:
        return {"status": "error", "message": str(e)}

    rooms = [
        {
            "id": r["id"], "label": r["label"], "roomTypeName": r["roomTypeName"],
            "rate": r.get("baseRate", 0), "maxOccupancy": r.get("maxOccupancy", 0),
            "photos": r.get("photos") or [], "facing": r.get("facing"),
            "view": r.get("view"), "amenities": r.get("amenities") or [],
        }
        for r in rooms
    ]
    if guests > 0:
        rooms = sorted((r for r in rooms if r["maxOccupancy"] >= guests), key=lambda r: r["maxOccupancy"])
        if not rooms:
            return {
                "status": "success", "room_count": 0,
                "message": f"No room sleeps {guests} — the largest fits fewer. Suggest a smaller group size or two rooms.",
            }

    # Empty dates → the card renders as a browse gallery (no Book buttons); the
    # guest picks dates before booking. Mirrors the reference's rooms_get_details.
    _push_ui(tool_context, ui.rooms_component(rooms, "", ""))
    return {
        "status": "success",
        "room_count": len(rooms),
        "note": "Cards with photos are shown. Rates are base per-night; exact price needs dates.",
        "rooms": [
            {
                "label": r["label"], "type": r["roomTypeName"], "sleeps": r["maxOccupancy"],
                "base_rate": r["rate"], "facing": r.get("facing"), "view": r.get("view"),
                "amenities": r.get("amenities") or [],
            }
            for r in rooms
        ],
    }


async def check_availability(tool_context: ToolContext, check_in: str, check_out: str, guests: int = 0) -> dict[str, Any]:
    """Show which rooms are free for a stay and their nightly rate.

    Args:
        check_in: check-in date, YYYY-MM-DD
        check_out: check-out date, YYYY-MM-DD (must be after check_in)
        guests: how many people the stay is for, if the guest has said so (e.g.
            "a room for 4", "4 of us"). Only rooms that fit are shown. Pass 0 if
            not mentioned — don't ask just to fill this in.
    """
    try:
        free = await _availability_with_rates(check_in, check_out)
    except OtaError as e:
        return {"status": "error", "message": str(e)}

    if guests > 0:
        # Smallest room that still fits first — a group of 2 shouldn't see the
        # 6-person suite ahead of a room sized for them.
        free = sorted((r for r in free if r["maxOccupancy"] >= guests), key=lambda r: r["maxOccupancy"])
        if not free:
            return {
                "status": "success", "available_count": 0,
                "message": f"No room sleeps {guests} for {check_in} to {check_out} — the largest fits fewer. Want me to check a smaller group size, or suggest booking two rooms?",
            }

    if not free:
        return {"status": "success", "available_count": 0, "message": f"No rooms are free for {check_in} to {check_out}."}

    _push_ui(tool_context, ui.rooms_component(free, check_in, check_out))
    return {
        "status": "success",
        "available_count": len(free),
        # facing/view/amenities are given as text so the model can answer
        # "does it face east / is it poolside / what's included" directly;
        # photo URLs are UI-only (rendered by the card, not read by the model).
        "rooms": [
            {
                "id": r["id"], "label": r["label"], "type": r["roomTypeName"], "rate": r["rate"],
                "facing": r.get("facing"), "view": r.get("view"), "amenities": r.get("amenities") or [],
            }
            for r in free
        ],
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


async def request_booking_change(
    tool_context: ToolContext, change: str, details: str,
    guest_name: str = "", guest_phone: str = "", booking_ref: str = "",
) -> dict[str, Any]:
    """File a request to CANCEL or MODIFY an existing booking. The assistant must
    NEVER cancel or change a booking itself — this always goes to a human, who
    resolves it from the queue. Use this whenever someone asks to cancel, change
    dates, change room, or otherwise alter a confirmed booking.

    Args:
        change: "cancel" or "modify"
        details: what is being asked — the booking, the change, and any reason
        guest_name: the guest's name, if known
        guest_phone: the guest's phone, if known
        booking_ref: the booking reference / id, if known
    """
    kind = "cancellation" if change.strip().lower().startswith("cancel") else "change"
    title = f"Booking {kind} request"
    if booking_ref:
        title += f" · {booking_ref}"
    summary = f"{kind.capitalize()} requested: {details.strip()}"
    who = " ".join(p for p in (guest_name.strip(), guest_phone.strip()) if p)
    if who:
        summary += f" — guest: {who}"
    try:
        result = await _client.create_escalation({
            "source": "assistant", "category": "booking", "severity": "medium",
            "title": title[:160], "summary": summary[:4000],
            "raisedBy": {"name": guest_name.strip() or None, "contact": guest_phone.strip() or None},
        })
    except OtaError as e:
        return {"status": "error", "message": str(e)}
    return {"status": "filed", "escalation": result}


async def pass_to_property(
    tool_context: ToolContext, topic: str, details: str,
    guest_name: str = "", guest_phone: str = "",
) -> dict[str, Any]:
    """File a guest's request or question with the property so a human follows
    up. Use this whenever the guest asks for something you can't do or don't
    have information about — early check-in, airport pickup / a cab, extra bed,
    special meals, a question the FAQ doesn't answer, a complaint, anything.
    NEVER just say "I'll pass it on" without calling this — that would lose the
    request. Get the guest's name and phone if you can, but file even without.

    Args:
        topic: a few words naming the request, e.g. "Early check-in request"
        details: what the guest asked for, in full
        guest_name: the guest's name, if known
        guest_phone: the guest's phone, if known
    """
    title = topic.strip() or "Guest request"
    summary = details.strip() or title
    who = " ".join(p for p in (guest_name.strip(), guest_phone.strip()) if p)
    if who:
        summary += f" — guest: {who}"
    try:
        result = await _client.create_escalation({
            "source": "assistant", "category": "customer", "severity": "medium",
            "title": title[:160], "summary": summary[:4000],
            "raisedBy": {"name": guest_name.strip() or None, "contact": guest_phone.strip() or None},
        })
    except OtaError as e:
        return {"status": "error", "message": str(e)}
    return {"status": "filed", "escalation": result,
            "message": "Filed for the property. Tell the guest it's been passed on and they'll be contacted."}


async def _availability_with_rates(check_in: str, check_out: str) -> list[dict[str, Any]]:
    """Free rooms enriched with rate/occupancy/content from the catalog (one call each)."""
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
                "photos": cat.get("photos") or [],
                "facing": cat.get("facing"),
                "view": cat.get("view"),
                "amenities": cat.get("amenities") or [],
            }
        )
    return free
