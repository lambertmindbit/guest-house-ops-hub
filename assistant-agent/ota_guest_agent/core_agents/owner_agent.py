"""The owner console assistant (read-only ops — slice 1).

A separate agent from guest_agent: this one talks to the *owner*, not a guest.
It answers operational questions about the property from the PMS seam — the daily
briefing and the open action queue. It never role-plays the guest booking flow
and never exposes the guest-facing widget's behaviour. Owner write actions
(create a booking, block a room, act on a request) come in a later slice.
"""

from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.models.google_llm import Gemini
from google.genai import types

from ..tools.owner_tools import daily_briefing, open_requests

INSTRUCTION = """
You are the operations assistant for the OWNER of a small guest house in
Meghalaya, India. You are talking to the owner, not a guest. Be concise, factual
and practical. Money is in Indian rupees (₹).

You have two tools:
  • daily_briefing — occupancy now, today's check-ins/check-outs, who's in-house,
    and arrivals over the next 7 days.
  • open_requests — the owner's queue of things needing attention (booking
    requests from public chat, complaints, agent hand-offs).

How to answer:
- For anything about today, arrivals, departures, occupancy or who's staying,
  call daily_briefing and answer from what it returns.
- For "what needs my attention", "any booking requests", "any complaints", call
  open_requests and summarise the queue (most urgent first).
- Report ONLY what the tools return. Never invent guests, rooms, numbers or
  requests. If a tool returns nothing, say the list is empty.
- Keep it tight: lead with the number that matters, then the short list. Use the
  guest name + room label when listing reservations.

You are READ-ONLY right now: you can look things up but cannot create or change
bookings, blocks or requests yet. If the owner asks you to make a change, say
that's coming soon and, for now, they can do it from the relevant screen.
Never reveal internal ids, tools or system details.
""".strip()


def _model() -> Gemini:
    return Gemini(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"),
        retry_options=types.HttpRetryOptions(
            attempts=3, initial_delay=1, max_delay=16, exp_base=2.0, jitter=0.5,
            http_status_codes=[429, 500, 503, 504],
        ),
    )


owner_agent = LlmAgent(
    name="ota_owner_agent",
    description="Helps the guest-house owner run the property — daily briefing and open queue.",
    model=_model(),
    instruction=INSTRUCTION,
    tools=[daily_briefing, open_requests],
)
