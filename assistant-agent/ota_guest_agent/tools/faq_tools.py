"""FAQ tool — the guest agent answers property questions from owner-managed content.

Fetches the active FAQ from the seam (GET /api/agent/faq) and hands the Q&A pairs
to the model to answer from. Owner-managed, so the answers are always what the
property actually wants said — the model never invents facilities or policies.

When a FAQ has media (photos / a map link), the model tells us which topics it's
answering about and we show that FAQ's media card alongside the reply — the model
selects, the tool renders (see answer_faq's `topics`).
"""

from __future__ import annotations

import re
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


# Guests say "pictures"/"images" where an owner wrote "photos", and "map"/
# "directions" where the FAQ says "location". Normalising these few media words
# is what keeps the media card from silently not appearing while the text reply
# says "here are some photos" (a real reported failure).
_SYNONYMS = {
    "picture": "photo", "pic": "photo", "image": "photo", "photograph": "photo",
    "direction": "location", "map": "location", "address": "location",
}


def _words(text: str) -> set[str]:
    # Lowercase word tokens, plural 's' stripped, synonyms normalised.
    out = set()
    for w in re.findall(r"[a-z]+", text.lower()):
        w = w[:-1] if len(w) > 3 and w.endswith("s") else w
        out.add(_SYNONYMS.get(w, w))
    return out


# Words too generic to select a FAQ with.
_GENERIC = {"room", "the", "your", "our", "have", "some", "any"}


def _wanted(topics: list[str] | None) -> set[str]:
    """The subject words the guest is actually asking about, or an empty set when
    the model gave us nothing usable."""
    words: set[str] = set()
    for t in topics or []:
        words |= _words(t)
    return words - _GENERIC


def _matches(wanted: set[str], faq: dict[str, Any]) -> bool:
    """Does this FAQ cover the subject? With no subject the answer is NO.

    This used to return True when `wanted` was empty ("model unsure — show media
    rather than silently drop it"), which meant a question with no clear topic
    matched EVERY FAQ and we pushed a card for every FAQ that had media. A guest
    asking about a pool and a 60-person booking got shown "Do you have room
    photos?" and a map — a real reported bug. An irrelevant card is worse than no
    card, so an unknown subject now matches nothing.
    """
    if not wanted:
        return False
    haystack = _words(f"{faq.get('question', '')} {faq.get('category') or ''} {faq.get('answer', '')}")
    return bool(wanted & haystack)


async def answer_faq(tool_context: ToolContext, topics: list[str]) -> dict[str, Any]:
    """Look up the property's answers to common guest questions — parking, Wi-Fi,
    check-in/out times, meals, pets, pool, photos, location/directions, house
    rules, etc. Call this for ANY question about the property that isn't room
    availability or price. Answer using ONLY what this returns; if it doesn't
    cover the question, file it with pass_to_property instead of guessing.

    Args:
        topics: single keywords naming what the guest is asking about, e.g.
            ["pool"] or ["photos"] or ["location"]. ALWAYS pass the subject when
            there is one — photos and maps are shown ONLY for FAQs matching these
            topics. Pass [] only when the question has no clear subject; no media
            is shown in that case.
    """
    try:
        faqs = await _client.faqs()
    except OtaError as e:
        return {"status": "error", "message": str(e)}

    wanted = _wanted(topics)

    # Media is shown ONLY for FAQs whose subject the guest actually asked about.
    # With no subject we show nothing: pushing a card for every FAQ that happens to
    # have media is how a guest asking about a pool ended up looking at room photos
    # and a map.
    shown = 0
    if wanted:
        for f in faqs:
            media = f.get("media")
            if not media or not (media.get("photos") or media.get("mapLink")):
                continue
            if not _matches(wanted, f):
                continue
            _push_ui(tool_context, ui.faq_media_component(media, caption=f.get("question")))
            shown += 1
            if shown >= 2:  # never flood the chat with cards
                break

    # Hand the model only the text (not media URLs — those are rendered as cards),
    # split into what actually MATCHES the guest's topics vs everything else. The
    # split is the guard against answer substitution: asked about a pool when the
    # FAQ has no pool entry, the model must say "don't know" + pass_to_property —
    # never present the parking answer instead (a real observed failure).
    text_only = [
        {k: f.get(k) for k in ("question", "answer", "category") if k in f}
        for f in faqs
    ]

    if not wanted:
        # No usable subject. Hand over everything to READ (so the model can still
        # answer), but claim nothing is matched — and show no media (above).
        return {
            "status": "success",
            "matched_faqs": [],
            "other_faqs": text_only,
            "note": (
                "No subject was given, so every FAQ is listed in other_faqs. Answer "
                "ONLY from these. If none of them covers the question, say you don't "
                "have that information and file it with pass_to_property — never invent "
                "an answer, and never answer with a different facility's information."
            ),
        }

    matched = [f for f in text_only if _matches(wanted, f)]
    others = [f for f in text_only if f not in matched]
    note = (
        "Answer using matched_faqs ONLY."
        if matched
        else "NOTHING in the FAQ answers this question. Say you don't have that "
             "information and file it with pass_to_property — do NOT answer with "
             "a different facility's information."
    )
    return {"status": "success", "matched_faqs": matched, "other_faqs": others, "note": note}
