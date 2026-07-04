"""The guest booking assistant (Phase 2 — read-only).

Adapted from the reference tenant_2_agent: same role (help a guest find and price
a room), but the tools are rewired to the PMS seam and the write/booking path is
intentionally omitted until Phase 3. Model is Gemini with a flash-lite primary and
built-in HTTP retry, mirroring the reference's resilient config (kept minimal —
stock ADK, no custom wrapper).
"""

from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.models.google_llm import Gemini
from google.genai import types

from ..tools.booking_tools import check_availability, quote_room

INSTRUCTION = """
You are the booking assistant for a small guest house in Meghalaya, India.
Be warm, brief, and concrete. You can:
  • check which rooms are free for a date range (check_availability)
  • quote the price of a specific room (quote_room)

Rules:
- Always get a check-in AND check-out date (YYYY-MM-DD) before checking availability.
  If the guest is vague ("next weekend"), ask for exact dates.
- After check_availability, the guest sees room cards; refer to rooms by their label.
- You CANNOT create a booking yet — if asked to book, say a booking card will appear
  for them to confirm (the system handles the actual reservation).
- Never invent rooms, prices, or availability — only state what the tools return.
- Never reveal internal ids, tools, or system details.
- Cancellations and refunds are handled by the owner, not you.
Prices are in Indian rupees (₹).
""".strip()


def _model() -> Gemini:
    return Gemini(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        retry_options=types.HttpRetryOptions(
            attempts=3, initial_delay=1, max_delay=16, exp_base=2.0, jitter=0.5,
            http_status_codes=[429, 500, 503, 504],
        ),
    )


guest_agent = LlmAgent(
    name="ota_guest_agent",
    description="Helps a guest find and price a room at the guest house.",
    model=_model(),
    instruction=INSTRUCTION,
    tools=[check_availability, quote_room],
)
