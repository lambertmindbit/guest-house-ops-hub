"""Assemble a persona's full instruction, fresh each turn.

Order matters: the current date leads, then the role body, then owner policies,
then the fixed FORMATTING / ACCURACY / SECURITY blocks, then the persona closing.
SECURITY sits at the END (only the closing follows it) so that with an
instruction-following model the final constraints bind hardest — and so
owner-authored policy text physically appears ABOVE it and can only tighten,
never override, the guardrails.

This is an ADK InstructionProvider: an async callable ADK awaits per turn. That's
what lets both the date and the owner policies refresh without a redeploy.
"""

from __future__ import annotations

from google.adk.agents.readonly_context import ReadonlyContext

from ..services.dates import today_line
from ..services.policies import policies_section
from . import blocks


def build_instruction(role_body: str, closing: str):
    async def provider(ctx: ReadonlyContext) -> str:
        policies = await policies_section()
        parts = [
            today_line(),
            role_body.strip(),
            policies,
            blocks.FORMATTING,
            blocks.ACCURACY,
            blocks.SECURITY,
            closing,
        ]
        return "\n\n".join(p for p in parts if p and p.strip())

    return provider
