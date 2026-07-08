"""Date grounding for agent instructions.

An LLM has no notion of "today" unless told — left ungrounded, a model asked to
book "10 July" with no year will guess a year from its training data (we saw it
guess 2023) instead of the actual upcoming date. Every agent instruction is
built through `dated_instruction` so the model is re-grounded on the CURRENT
date — the property's local time, IST, per CLAUDE.md's timezone rule — on
EVERY turn via an ADK InstructionProvider callable, not baked in once at
process start (this process can run for days on Cloud Run).
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from google.adk.agents.readonly_context import ReadonlyContext

_IST = ZoneInfo("Asia/Kolkata")


def today_line() -> str:
    now = datetime.now(_IST)
    return (
        f"Today's date is {now.strftime('%d-%b-%Y')} ({now.strftime('%A')}), Indian "
        "Standard Time — ground every date against this. A date given without a "
        "year (e.g. \"10 July\") means the NEXT upcoming occurrence of that day "
        "from today, never a past or arbitrary year. Tool calls always use "
        "YYYY-MM-DD, but when you SPEAK a date to the guest or owner, always write "
        "it as DD-Mon-YYYY (e.g. \"10-Jul-2026\") — the Indian format."
    )


# Backwards-compat alias (older imports used the private name).
_today_line = today_line


def dated_instruction(body: str):
    """Wrap a static instruction body in an ADK InstructionProvider so the date
    line is recomputed fresh on every turn instead of frozen at import time."""

    def provider(ctx: ReadonlyContext) -> str:
        return f"{_today_line()}\n\n{body}"

    return provider
