"""Generative-UI component builders.

These produce the EXACT descriptor shapes the Next.js chat renders
(src/lib/assistant/types.ts · UIComponent). The agent "renders UI" by appending
one of these to tool_context.state["_ui"]; the server (server.py) drains that list
and emits each as a {"type":"ui","component": ...} StreamChunk. Keep these in sync
with the TypeScript union.
"""

from __future__ import annotations

from typing import Any


def rooms_component(rooms: list[dict[str, Any]], check_in: str, check_out: str) -> dict[str, Any]:
    return {
        "type": "rooms",
        "checkIn": check_in,
        "checkOut": check_out,
        "data": [
            {
                "id": r["id"],
                "label": r["label"],
                "roomTypeName": r["roomTypeName"],
                "maxOccupancy": r.get("maxOccupancy", 0),
                "rate": r.get("rate", r.get("baseRate", 0)),
                "free": True,
            }
            for r in rooms
        ],
    }


def quote_component(room: dict[str, Any], check_in: str, check_out: str, nights: int, total: float) -> dict[str, Any]:
    return {
        "type": "quote",
        "data": {
            "roomId": room["id"],
            "roomLabel": room["label"],
            "roomTypeName": room["roomTypeName"],
            "checkIn": check_in,
            "checkOut": check_out,
            "nights": nights,
            "total": total,
        },
    }


def faq_media_component(media: dict[str, Any], caption: str | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if caption:
        data["caption"] = caption
    if media.get("photos"):
        data["photos"] = media["photos"]
    if media.get("mapLink"):
        data["mapLink"] = media["mapLink"]
    return {"type": "faq_media", "data": data}


def booking_form_component(room: dict[str, Any], check_in: str, check_out: str) -> dict[str, Any]:
    return {
        "type": "booking_form",
        "data": {
            "roomId": room["id"],
            "roomLabel": room["label"],
            "roomTypeName": room["roomTypeName"],
            "checkIn": check_in,
            "checkOut": check_out,
        },
    }


def confirm_component(
    room: dict[str, Any], check_in: str, check_out: str, nights: int, total: float,
    guest_name: str | None = None, guest_phone: str | None = None,
) -> dict[str, Any]:
    return {
        "type": "confirm_booking",
        "data": {
            "roomId": room["id"],
            "roomLabel": room["label"],
            "roomTypeName": room["roomTypeName"],
            "checkIn": check_in,
            "checkOut": check_out,
            "nights": nights,
            "total": total,
            "guestName": guest_name,
            "guestPhone": guest_phone,
        },
    }


def otp_component(note: str, demo_code: str | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {"note": note}
    if demo_code is not None:
        data["demoCode"] = demo_code
    return {"type": "otp", "data": data}
