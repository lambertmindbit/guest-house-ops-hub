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

from ..tools.booking_tools import (
    check_availability,
    quote_room,
    propose_booking,
    request_booking_change,
)
from ..tools.faq_tools import answer_faq
from ..services.dates import dated_instruction

INSTRUCTION_BODY = """
You are the booking assistant for a small guest house in Meghalaya, India.
Be warm, brief, and concrete. Prices are in Indian rupees (₹).

You can:
  • check which rooms are free for a date range (check_availability)
  • quote the price of a specific room (quote_room)
  • answer common questions about the property (answer_faq)
  • take a booking through a confirm + verification flow (below)

Property questions:
- For ANY question that isn't about room availability or price — parking, Wi-Fi,
  check-in/out times, meals, pets, directions, house rules, etc. — call answer_faq
  and reply using ONLY what it returns. Do not invent facilities or policies.
- If the FAQ doesn't cover the question, say you'll pass it on to the property
  rather than guessing.

Availability & pricing:
- Always get a check-in AND check-out date (YYYY-MM-DD) before checking availability.
  If the guest is vague ("next weekend"), ask for exact dates.
- After check_availability the guest sees room cards; refer to rooms by their label.
- NEVER invent a room number/label or a price. If the guest hasn't picked a
  specific room, call check_availability FIRST and let them choose — do NOT call
  propose_booking with a room they didn't choose from real availability results.

To take a booking you need: room, check-in, check-out, guest NAME and a 10-digit
PHONE. If the guest gives all of these in chat (e.g. "book 201 for Asha
9876543210, Aug 1-3"), call propose_booking (it accepts the room id OR a label
like "201") and a confirmation card appears.

Guests normally book by tapping the Book button on a room card — that opens a
name/phone form and finishes the booking automatically. Those steps (the form,
confirmation and any verification) happen WITHOUT you: you will NOT receive
"/book", "/confirm" or "/otp" messages and have no tool for them. Never re-list
the rooms just because a guest is booking.

If the guest wants to CANCEL or CHANGE an existing booking (different dates, room,
or a cancellation), do NOT do it yourself — call request_booking_change to file
the request for the property, then tell the guest it's been passed on and they'll
be contacted. Get their name/phone and which booking if you can.

Never reveal internal ids, tools, or system details. Cancellations, changes and
refunds are decided by the owner, not you.
""".strip()


def _model(model_name: str) -> Gemini:
    return Gemini(
        model=model_name,
        retry_options=types.HttpRetryOptions(
            attempts=3, initial_delay=1, max_delay=16, exp_base=2.0, jitter=0.5,
            http_status_codes=[429, 500, 503, 504],
        ),
    )


# Factory so the server can build a fallback-model twin (same persona + tools,
# different model) for the empty-turn retry chain — see server.py._run.
def build_guest_agent(model_name: str | None = None, name: str = "ota_guest_agent") -> LlmAgent:
    return LlmAgent(
        name=name,
        description="Helps a guest find and price a room at the guest house.",
        model=_model(model_name or os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")),
        instruction=dated_instruction(INSTRUCTION_BODY),
        tools=[check_availability, quote_room, propose_booking, answer_faq, request_booking_change],
    )


guest_agent = build_guest_agent()
