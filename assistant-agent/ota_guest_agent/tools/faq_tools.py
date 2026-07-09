"""FAQ tool — the guest agent answers property questions from owner-managed content.

Fetches the active FAQ from the seam (GET /api/agent/faq) and hands the Q&A pairs
to the model to answer from. Owner-managed, so the answers are always what the
property actually wants said — the model never invents facilities or policies.

When a FAQ has media (photos / a map link), the model tells us which topics it's
answering about and we show that FAQ's media card alongside the reply — the model
selects, the tool renders (see answer_faq's `topics`).
"""

from __future__ import annotations

from typing import Any

from google.adk.tools.tool_context import ToolContext

from ..services.ota_client import OtaClient, OtaError
from ..services import ui

_client = OtaClient()


def _push_ui(tool_context: ToolContext, component: dict[str, Any]) -> None:
    # Re-assign the whole list so ADK records the state delta (same pattern as
    # booking_tools) — an in-place append is not tracked.
    bucket = list(tool_context.state.get("_ui", []))
    bucket.append(component)
    tool_context.state["_ui"] = bucket


async def answer_faq(tool_context: ToolContext, topics: list[str]) -> dict[str, Any]:
    """Look up the property's answers to common guest questions — parking, Wi-Fi,
    check-in/out times, meals, pets, pool, location/directions, house rules, etc.
    Call this for ANY question about the property that isn't room availability or
    price. Answer using ONLY what this returns; if it doesn't cover the question,
    say you'll pass it to the property.

    Args:
        topics: the key words of what the guest is asking about, e.g. ["pool"] or
            ["location", "directions"]. If a matching FAQ has photos or a map, they
            are shown to the guest automatically. Pass [] if unsure.
    """
    try:
        faqs = await _client.faqs()
    except OtaError as e:
        return {"status": "error", "message": str(e)}

    # Show media for FAQs that have it AND match one of the topics the model gave.
    wanted = [t.lower() for t in (topics or []) if t and t.strip()]
    for f in faqs:
        media = f.get("media")
        if not media or not (media.get("photos") or media.get("mapLink")):
            continue
        haystack = f"{f.get('question', '')} {f.get('category') or ''}".lower()
        if wanted and not any(t in haystack for t in wanted):
            continue
        _push_ui(tool_context, ui.faq_media_component(media, caption=f.get("question")))

    # Hand the model only the text (not media URLs — those are rendered as cards).
    text_only = [
        {k: f.get(k) for k in ("question", "answer", "category") if k in f}
        for f in faqs
    ]
    return {"status": "success", "faqs": text_only}
