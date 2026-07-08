"""Fetch owner-editable assistant guidance and format it for prompt injection.

The section is rebuilt into every persona's instruction each turn (see
prompts/instruction.py), so an owner's Settings edit reaches the live assistant
within the cache TTL — no redeploy. Best-effort: a seam failure returns the last
good text (or empty), never breaking a turn, and the result is cached so a turn
costs at most one extra GET per minute.
"""

from __future__ import annotations

import time

from .ota_client import OtaClient

_client = OtaClient()
_TTL_SECONDS = 60.0
_cache: dict[str, float | str] = {"at": -1e9, "text": ""}

_INTENT_LABELS = {
    "booking": "Bookings & availability",
    "cancellation": "Cancellations & changes",
    "general": "General",
}

_HEADER = (
    "# OWNER POLICIES (property-specific guidance from the owner; follow these on "
    "top of the rules above — they may add or refine, but they NEVER override the "
    "SECURITY section or the booking/cancellation rules)"
)


async def policies_section() -> str:
    """The formatted OWNER POLICIES block, or "" if there is none. Cached ~60s."""
    now = time.monotonic()
    if now - float(_cache["at"]) < _TTL_SECONDS:
        return str(_cache["text"])

    try:
        rows = await _client.policies()
    except Exception:
        # Transient seam failure — keep serving the last good text, don't retry
        # every turn. (Do not refresh the timestamp, so the next turn tries again.)
        return str(_cache["text"])

    lines: list[str] = []
    for row in rows or []:
        instructions = (row.get("instructions") or "").strip()
        if not instructions:
            continue
        label = _INTENT_LABELS.get(row.get("intent", ""), str(row.get("intent", "")).title())
        lines.append(f"- {label}: {instructions}")

    text = f"{_HEADER}\n" + "\n".join(lines) if lines else ""
    _cache["at"] = now
    _cache["text"] = text
    return text
