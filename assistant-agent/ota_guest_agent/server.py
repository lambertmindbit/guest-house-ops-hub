"""HTTP bridge: the endpoint the OTA app's /assistant proxy calls.

POST /chat {message, sessionId?}  ->  NDJSON stream of StreamChunk objects
identical to src/lib/assistant/types.ts, so the Next.js chat renders the agent's
turns with the same code path as the Phase-1 stub:
    {"type":"text","delta":"…"}      # streamed as the model speaks
    {"type":"ui","component":{…}}    # a generative-UI card a tool produced
    {"type":"done"}

Auth: if ASSISTANT_AGENT_TOKEN is set, requests must carry it as a Bearer (the
OTA proxy sends it). The seam token (OTA_AGENT_TOKEN) is separate and used by the
tools to call the PMS.

Run locally:  uvicorn ota_guest_agent.server:api --port 8080
Deploy:       any Python host (e.g. Cloud Run); point ASSISTANT_AGENT_URL at
              <host>/chat in the OTA app's env.

⚠ NOT YET RUN. This is written against the reference's ADK usage and is
syntax-checked only. The ADK Runner streaming details (event/part shape, session
lifecycle) must be verified against the installed google-adk version + a real
GEMINI_API_KEY before it will serve. See README.md.
"""

from __future__ import annotations

import json
import os
import uuid
from typing import AsyncIterator

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Header, HTTPException, Request  # noqa: E402
from fastapi.responses import StreamingResponse  # noqa: E402
from google.adk.events import Event, EventActions  # noqa: E402
from google.adk.runners import Runner  # noqa: E402
from google.adk.sessions import InMemorySessionService  # noqa: E402
from google.genai import types  # noqa: E402

from .core_agents.guest_agent import guest_agent  # noqa: E402
from .services.ota_client import OtaClient, OtaError, RoomJustTaken  # noqa: E402
from .services import ui  # noqa: E402

APP_NAME = "ota_guest_agent"
USER_ID = "guest"

api = FastAPI(title="OTA Guest Assistant")
_session_service = InMemorySessionService()
_runner = Runner(app_name=APP_NAME, agent=guest_agent, session_service=_session_service)
_ota = OtaClient()


def _line(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False) + "\n"


async def _set_state(session, delta: dict) -> None:
    # The reliable way to update session state outside a tool.
    await _session_service.append_event(session, Event(author="system", actions=EventActions(state_delta=delta)))


async def _handle_slash(message: str, session_id: str, mode: str = "owner"):
    """Deterministic handling of the /quote, /confirm and /otp card actions — NO
    LLM call (faster, cheaper, and immune to model overload/quota on these steps).
    Returns an async generator of NDJSON lines, or None if not one of these.
    propose_booking (LLM) already stored the pending booking in session state.

    mode="owner"  (default, the in-app assistant): /confirm → demo OTP → /otp writes
        a real reservation through the guarded seam.
    mode="public" (the anonymous guest widget): /confirm files a booking REQUEST
        escalation for the owner to confirm — NO OTP, NO reservation. An anonymous
        guest can never create a confirmed booking."""
    msg = message.strip()
    if not (msg.startswith("/quote") or msg.startswith("/confirm") or msg.startswith("/otp")):
        return None

    import random

    async def gen():
        # /quote <roomId> <checkIn> <checkOut> — deterministic price card, NO LLM call.
        if msg.startswith("/quote"):
            parts = msg.split()
            if len(parts) < 4:
                yield _line({"type": "text", "delta": "Tap a room's Price to see its cost."})
                yield _line({"type": "done"})
                return
            room_id, check_in, check_out = parts[1], parts[2], parts[3]
            try:
                room = {r["id"]: r for r in await _ota.rooms()}.get(room_id)
                if not room:
                    yield _line({"type": "text", "delta": "That room isn't available anymore — please check availability again."})
                    yield _line({"type": "done"})
                    return
                quote = await _ota.quote(room_id, check_in, check_out)
            except OtaError as exc:
                yield _line({"type": "text", "delta": f"I couldn't get that price ({exc})."})
                yield _line({"type": "done"})
                return
            nights = len(quote.get("nights", []))
            total = quote.get("total", 0)
            yield _line({"type": "ui", "component": ui.quote_component(room, check_in, check_out, nights, total)})
            yield _line({"type": "text", "delta": f"{room['label']}: ₹{total} for {nights} night(s). Tap Book to continue."})
            yield _line({"type": "done"})
            return

        # /confirm and /otp need the pending booking that propose_booking stored.
        session = await _session_service.get_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        state = dict(session.state) if session else {}
        pending = state.get("_pending")
        if session is None or not pending:
            yield _line({"type": "text", "delta": "I don't have a booking ready to confirm — let's start again with your dates."})
            yield _line({"type": "done"})
            return

        if msg.startswith("/confirm"):
            if mode == "public":
                # File a request for the owner to confirm — no reservation is created.
                summary = (
                    f"Guest {pending['guestName']} ({pending['guestPhone']}) requested "
                    f"{pending['roomLabel']} ({pending['roomTypeName']}), {pending['checkIn']} → {pending['checkOut']}, "
                    f"{pending['nights']} night(s), about ₹{pending['total']}. Sent from the public chat widget — "
                    f"please confirm availability and contact the guest."
                )
                try:
                    await _ota.create_escalation({
                        "source": "assistant", "category": "booking", "severity": "medium",
                        "title": f"Booking request: {pending['roomLabel']} {pending['checkIn']}→{pending['checkOut']}",
                        "summary": summary,
                        "raisedBy": {"name": pending["guestName"], "contact": pending["guestPhone"]},
                    })
                except OtaError as exc:
                    yield _line({"type": "text", "delta": f"I couldn't send your request ({exc}). Please try again."})
                    yield _line({"type": "done"})
                    return
                await _set_state(session, {"_pending": None})
                yield _line({"type": "text", "delta": f"Thank you, {pending['guestName']}! 🙏 I've sent your request for {pending['roomLabel']} ({pending['checkIn']} → {pending['checkOut']}) to the property. They'll confirm availability and reach you on {pending['guestPhone']} shortly."})
                yield _line({"type": "done"})
                return

            code = f"{random.randint(0, 9999):04d}"
            await _set_state(session, {"_otp": code})
            yield _line({"type": "ui", "component": ui.otp_component(f"Enter the code sent to {pending['guestPhone']} to confirm.", demo_code=code)})
            yield _line({"type": "text", "delta": "Almost done — enter the code above to confirm your booking."})
            yield _line({"type": "done"})
            return

        # /otp <code>
        parts = msg.split(maxsplit=1)
        code = parts[1].strip() if len(parts) > 1 else ""
        if code != str(state.get("_otp")):
            yield _line({"type": "text", "delta": "That code doesn't match — please try again."})
            yield _line({"type": "done"})
            return

        body = {
            "roomId": pending["roomId"], "channelId": _ota.channel_id,
            "checkIn": pending["checkIn"], "checkOut": pending["checkOut"],
            "guest": {"name": pending["guestName"], "phone": pending["guestPhone"]},
            "grossAmount": pending["total"],
        }
        try:
            reservation = await _ota.create_reservation(body)
        except RoomJustTaken:
            await _set_state(session, {"_pending": None, "_otp": None})
            yield _line({"type": "text", "delta": "Sorry — that room was just booked by someone else. Want me to check other options?"})
            yield _line({"type": "done"})
            return
        except OtaError as exc:
            yield _line({"type": "text", "delta": f"I couldn't complete the booking ({exc})."})
            yield _line({"type": "done"})
            return

        await _set_state(session, {"_pending": None, "_otp": None})
        yield _line({"type": "text", "delta": f"✅ Booked! Reference #{reservation.get('id')} — {pending['roomLabel']}, {pending['checkIn']} → {pending['checkOut']} for {pending['guestName']}."})
        yield _line({"type": "done"})

    return gen()


async def _run(message: str, session_id: str) -> AsyncIterator[str]:
    # Fresh state bucket per turn so tool-produced UI doesn't leak across turns.
    try:
        await _session_service.create_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id, state={"_ui": []})
    except Exception:
        # Session already exists — reset the per-turn UI bucket.
        session = await _session_service.get_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        if session is not None:
            session.state["_ui"] = []

    content = types.Content(role="user", parts=[types.Part(text=message)])
    try:
        async for event in _runner.run_async(user_id=USER_ID, session_id=session_id, new_message=content):
            parts = getattr(getattr(event, "content", None), "parts", None) or []
            for part in parts:
                text = getattr(part, "text", None)
                if text:
                    yield _line({"type": "text", "delta": text})
    except Exception as exc:  # keep the transport honest — surface, don't crash
        yield _line({"type": "error", "message": f"assistant error: {exc}"})

    session = await _session_service.get_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
    for component in (session.state.get("_ui") if session else []) or []:
        yield _line({"type": "ui", "component": component})

    yield _line({"type": "done"})


@api.post("/chat")
async def chat(request: Request, authorization: str | None = Header(default=None)) -> StreamingResponse:
    expected = os.getenv("ASSISTANT_AGENT_TOKEN")
    if expected:
        got = (authorization or "").removeprefix("Bearer ").strip()
        if got != expected:
            raise HTTPException(status_code=401, detail="unauthorized")

    body = await request.json()
    message = (body or {}).get("message", "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="message is required")
    session_id = (body or {}).get("sessionId") or f"web-{uuid.uuid4().hex}"
    mode = "public" if (body or {}).get("mode") == "public" else "owner"

    # Button actions (/confirm, /otp) are handled deterministically without an LLM
    # call; everything else goes to the agent. In public mode /confirm files a
    # booking request rather than creating a reservation.
    handled = await _handle_slash(message, session_id, mode)
    stream = handled if handled is not None else _run(message, session_id)
    return StreamingResponse(stream, media_type="application/x-ndjson")


@api.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}
