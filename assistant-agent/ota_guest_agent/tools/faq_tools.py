"""FAQ tool — the guest agent answers property questions from owner-managed content.

Fetches the active FAQ from the seam (GET /api/agent/faq) and hands the Q&A pairs
to the model to answer from. Owner-managed, so the answers are always what the
property actually wants said — the model never invents facilities or policies.
"""

from __future__ import annotations

from typing import Any

from google.adk.tools.tool_context import ToolContext

from ..services.ota_client import OtaClient, OtaError

_client = OtaClient()


async def answer_faq(tool_context: ToolContext) -> dict[str, Any]:
    """Look up the property's answers to common guest questions — parking, Wi-Fi,
    check-in/out times, meals, pets, directions, house rules, etc. Call this for
    ANY question about the property that isn't about room availability or price.
    Answer the guest using ONLY what this returns; if it doesn't cover the
    question, say you'll pass it to the property."""
    try:
        faqs = await _client.faqs()
    except OtaError as e:
        return {"status": "error", "message": str(e)}
    return {"status": "success", "faqs": faqs}
