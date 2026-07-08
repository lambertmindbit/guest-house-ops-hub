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
import logging
import os
import re
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

from .core_agents.guest_agent import guest_agent, build_guest_agent  # noqa: E402
from .core_agents.owner_agent import owner_agent, build_owner_agent  # noqa: E402
from .services.ota_client import OtaClient, OtaError, RoomJustTaken  # noqa: E402
from .services import ui  # noqa: E402

APP_NAME = "ota_guest_agent"
USER_ID = "guest"
# The owner console is a separate agent + session namespace so owner turns never
# share state or persona with the guest/public path.
OWNER_APP_NAME = "ota_owner_agent"
OWNER_USER_ID = "owner"

# Fallback model for the empty-turn retry chain (see _run). Gemini occasionally
# returns an empty candidate under load; the last attempt of a turn switches to
# this model. Same free/billing account, different capacity bucket.
FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")

logger = logging.getLogger(__name__)

api = FastAPI(title="OTA Guest Assistant")
# Sessions (conversation + the pending-booking `_pending` state) live in THIS
# process's memory. That makes the Cloud Run service stateful: it MUST run at
# most one instance (`--max-instances=1`). A second instance would serve a
# guest's follow-up turn from a different memory and lose their pending booking
# mid-flow. Scaling past 1 requires a persistent ADK session service first
# (see the architecture upgrade plan, decision D1).
_session_service = InMemorySessionService()
_runner = Runner(app_name=APP_NAME, agent=guest_agent, session_service=_session_service)
_owner_runner = Runner(app_name=OWNER_APP_NAME, agent=owner_agent, session_service=_session_service)
# Fallback-model twins share the SAME app_name/session namespace as their primary
# so a fallback attempt reads/writes the same session (its _pending, _ui state).
_fallback_runner = Runner(
    app_name=APP_NAME, agent=build_guest_agent(FALLBACK_MODEL, name="ota_guest_agent_fb"),
    session_service=_session_service,
)
_owner_fallback_runner = Runner(
    app_name=OWNER_APP_NAME, agent=build_owner_agent(FALLBACK_MODEL, name="ota_owner_agent_fb"),
    session_service=_session_service,
)
_ota = OtaClient()


def _line(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False) + "\n"


async def _set_state(session, delta: dict) -> None:
    # The reliable way to update session state outside a tool.
    await _session_service.append_event(session, Event(author="system", actions=EventActions(state_delta=delta)))


async def _quote_lines(msg: str) -> AsyncIterator[str]:
    """The deterministic /quote price card — shared by the public and owner paths.
    `/quote <roomId> <checkIn> <checkOut>`; NO LLM call."""
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


async def _room_still_free(room_id: str, check_in: str, check_out: str) -> bool:
    """Best-effort availability re-check at each booking step (/book, /bookdetails,
    /confirm) — catches a room that got taken WHILE the guest was filling in their
    details, so they hear about it right away instead of after a request sits in
    the owner's queue. The GiST constraint at the actual write is still the only
    hard guarantee; a transient check failure here never blocks the flow."""
    try:
        avail = await _ota.room_availability(check_in, check_out, [room_id])
    except OtaError:
        return True
    row = next((a for a in avail if a["id"] == room_id), None)
    return bool(row and row.get("free"))


async def _handle_booking_step(message: str, session_id: str, app_name: str, user_id: str):
    """Deterministic booking button-flow — NO LLM (so the room list is never
    re-rendered, and it's immune to model overload/quota). Shared by the public
    and owner paths; the caller passes the session namespace so the pending
    booking is stored where /confirm will read it.

        /book <roomId> <ci> <co>                    → show the name/phone form
        /bookdetails <roomId> <ci> <co> <phone> <name...> → store pending + confirm card

    Returns an async generator, or None if this isn't a booking-step message."""
    msg = message.strip()

    if msg.startswith("/book "):
        parts = msg.split()
        if len(parts) < 4:
            return None
        room_id, check_in, check_out = parts[1], parts[2], parts[3]

        async def gen_form():
            try:
                room = next((r for r in await _ota.rooms() if r["id"] == room_id or r["label"] == room_id), None)
            except OtaError as exc:
                yield _line({"type": "text", "delta": f"Sorry, I couldn't load that room ({exc})."})
                yield _line({"type": "done"})
                return
            if not room:
                yield _line({"type": "text", "delta": "That room isn't available anymore — please check availability again."})
                yield _line({"type": "done"})
                return
            if not await _room_still_free(room["id"], check_in, check_out):
                yield _line({"type": "text", "delta": f"Sorry — {room['label']} is no longer free for those dates. Want to check other options?"})
                yield _line({"type": "done"})
                return
            yield _line({"type": "ui", "component": ui.booking_form_component(room, check_in, check_out)})
            yield _line({"type": "text", "delta": "Almost there — enter your name and phone to continue."})
            yield _line({"type": "done"})

        return gen_form()

    if msg.startswith("/bookdetails "):
        # /bookdetails <roomId> <ci> <co> <phone> <name...>
        parts = msg.split()
        room_id = parts[1] if len(parts) > 1 else ""
        check_in = parts[2] if len(parts) > 2 else ""
        check_out = parts[3] if len(parts) > 3 else ""
        phone = re.sub(r"\D", "", parts[4]) if len(parts) > 4 else ""
        name = " ".join(parts[5:]).strip()

        async def gen_details():
            if len(phone) != 10 or not name:
                yield _line({"type": "text", "delta": "Please enter your name and a valid 10-digit phone number."})
                yield _line({"type": "done"})
                return
            try:
                room = next((r for r in await _ota.rooms() if r["id"] == room_id or r["label"] == room_id), None)
                if not room:
                    yield _line({"type": "text", "delta": "That room isn't available anymore — please check availability again."})
                    yield _line({"type": "done"})
                    return
                if not await _room_still_free(room["id"], check_in, check_out):
                    yield _line({"type": "text", "delta": f"Sorry — {room['label']} was just booked for those dates. Want to check other options?"})
                    yield _line({"type": "done"})
                    return
                quote = await _ota.quote(room["id"], check_in, check_out)
            except OtaError as exc:
                yield _line({"type": "text", "delta": f"I couldn't price that stay ({exc})."})
                yield _line({"type": "done"})
                return

            nights = len(quote.get("nights", []))
            total = quote.get("total", 0)
            session = await _session_service.get_session(app_name=app_name, user_id=user_id, session_id=session_id)
            if session is None:
                await _session_service.create_session(app_name=app_name, user_id=user_id, session_id=session_id, state={"_ui": []})
                session = await _session_service.get_session(app_name=app_name, user_id=user_id, session_id=session_id)
            await _set_state(session, {"_pending": {
                "roomId": room["id"], "roomLabel": room["label"], "roomTypeName": room["roomTypeName"],
                "checkIn": check_in, "checkOut": check_out, "nights": nights, "total": total,
                "guestName": name, "guestPhone": phone,
            }})
            yield _line({"type": "ui", "component": ui.confirm_component(room, check_in, check_out, nights, total, name, phone)})
            yield _line({"type": "text", "delta": f"Please review and tap Confirm to book {room['label']}."})
            yield _line({"type": "done"})

        return gen_details()

    return None


async def _handle_owner_slash(message: str, session_id: str):
    """Deterministic owner-console card actions — NO LLM call.
    /quote → price card (shared). /confirm → write the reservation DIRECTLY through
    the guarded seam (no OTP: the owner is trusted and already authenticated). The
    pending booking was stored by propose_booking in the owner session state.
    Returns an async generator, or None if not one of these."""
    msg = message.strip()
    if not (msg.startswith("/quote") or msg.startswith("/confirm")):
        return None

    async def gen():
        if msg.startswith("/quote"):
            async for line in _quote_lines(msg):
                yield line
            return

        session = await _session_service.get_session(app_name=OWNER_APP_NAME, user_id=OWNER_USER_ID, session_id=session_id)
        pending = (dict(session.state) if session else {}).get("_pending")
        if session is None or not pending:
            yield _line({"type": "text", "delta": "I don't have a booking ready to confirm — tell me the room, dates, guest name and phone."})
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
            # The GiST no-double-booking constraint rejected it — never retry.
            await _set_state(session, {"_pending": None})
            yield _line({"type": "text", "delta": f"Those dates are no longer free for {pending['roomLabel']} — it was just booked. Want to try other dates or another room?"})
            yield _line({"type": "done"})
            return
        except OtaError as exc:
            yield _line({"type": "text", "delta": f"I couldn't complete the booking ({exc})."})
            yield _line({"type": "done"})
            return

        await _set_state(session, {"_pending": None})
        yield _line({"type": "text", "delta": f"✅ Booked! #{reservation.get('id')} — {pending['roomLabel']}, {pending['checkIn']} → {pending['checkOut']} for {pending['guestName']} ({pending['guestPhone']}), ₹{pending['total']}."})
        yield _line({"type": "done"})

    return gen()


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
            async for line in _quote_lines(msg):
                yield line
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
                # Last-moment re-check — the guest may have spent a while on the
                # form. Catching it here means "sorry, that's gone" arrives as part
                # of booking, not as a surprise days later when the owner tries to
                # approve a request that can no longer be honoured.
                if not await _room_still_free(pending["roomId"], pending["checkIn"], pending["checkOut"]):
                    await _set_state(session, {"_pending": None})
                    yield _line({"type": "text", "delta": f"Sorry — {pending['roomLabel']} is no longer available for those dates. Want to check other options?"})
                    yield _line({"type": "done"})
                    return

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
                        # Structured so the owner can approve with one tap (creates the
                        # reservation directly) instead of re-typing everything by hand.
                        "metadata": {
                            "kind": "booking_request",
                            "roomId": pending["roomId"], "roomLabel": pending["roomLabel"],
                            "roomTypeName": pending["roomTypeName"],
                            "checkIn": pending["checkIn"], "checkOut": pending["checkOut"],
                            "nights": pending["nights"], "total": pending["total"],
                            "guestName": pending["guestName"], "guestPhone": pending["guestPhone"],
                        },
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


async def _run(
    message: str,
    session_id: str,
    runner: Runner = _runner,
    app_name: str = APP_NAME,
    user_id: str = USER_ID,
    fallback_runner: Runner | None = None,
) -> AsyncIterator[str]:
    """Run one conversational turn, guaranteeing it never ends silently.

    Gemini under load either returns an empty candidate or fails outright (503/
    overloaded — both observed in prod). So each turn tries up to three attempts
    and stops the moment one produces any text OR a UI card: primary model,
    primary again (a plain retry usually clears a transient blip), then the
    FALLBACK_MODEL (a different-capacity model that tends to answer when the
    primary is overloaded). An attempt that comes back empty OR raises a transient
    error just falls through to the next attempt; only when all attempts fail does
    the guest get a friendly "please try again" instead of silence or a raw error.

    Exception: once an attempt has already streamed some text, a mid-stream error
    stops the chain — the partial answer is kept rather than re-run on another
    model (which would duplicate or contradict it)."""
    attempts: list[Runner] = [runner, runner]
    if fallback_runner is not None:
        attempts.append(fallback_runner)

    last_error: Exception | None = None
    for attempt_runner in attempts:
        # Fresh per-turn _ui bucket (also clears any UI a prior empty attempt left).
        try:
            await _session_service.create_session(app_name=app_name, user_id=user_id, session_id=session_id, state={"_ui": []})
        except Exception:
            session = await _session_service.get_session(app_name=app_name, user_id=user_id, session_id=session_id)
            if session is not None:
                session.state["_ui"] = []

        emitted = False
        content = types.Content(role="user", parts=[types.Part(text=message)])
        try:
            async for event in attempt_runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
                parts = getattr(getattr(event, "content", None), "parts", None) or []
                for part in parts:
                    text = getattr(part, "text", None)
                    if text:
                        emitted = True
                        yield _line({"type": "text", "delta": text})
        except Exception as exc:
            last_error = exc
            logger.warning("assistant turn attempt failed: %s", exc)
            if emitted:
                # A partial answer already reached the user — keep it, don't retry.
                yield _line({"type": "done"})
                return
            continue  # nothing streamed yet — try the next runner in the chain

        session = await _session_service.get_session(app_name=app_name, user_id=user_id, session_id=session_id)
        for component in (session.state.get("_ui") if session else []) or []:
            emitted = True
            yield _line({"type": "ui", "component": component})

        if emitted:
            yield _line({"type": "done"})
            return
        # Empty attempt — fall through to the next runner in the chain.

    # Every attempt came back empty or failed.
    if last_error is not None:
        logger.error("assistant turn exhausted all attempts; last error: %s", last_error)
    yield _line({"type": "text", "delta": "Sorry, I ran into a brief hiccup just now — could you send that to me again?"})
    yield _line({"type": "done"})


async def _logged(stream: AsyncIterator[str], message: str, session_id: str, mode: str) -> AsyncIterator[str]:
    """Tee the outgoing NDJSON stream: forward every line unchanged, accumulate
    the assistant's text, and log the finished turn for the owner's chat log.
    Best-effort — a logging failure (or an empty reply) never affects the chat."""
    reply_parts: list[str] = []
    async for line in stream:
        try:
            obj = json.loads(line)
            if obj.get("type") == "text":
                reply_parts.append(obj.get("delta", ""))
        except Exception:
            pass
        yield line
    reply = "".join(reply_parts).strip()
    if reply:
        try:
            await _ota.log_turn({"sessionId": session_id, "mode": mode, "userMessage": message, "reply": reply})
        except Exception:
            pass


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

    # The Book button flow (/book → name/phone form → /bookdetails → confirm card)
    # is fully deterministic in BOTH modes — no LLM, so the room list is never
    # re-rendered. Pending is stored in this mode's session namespace so /confirm
    # (below) reads it back.
    book_app, book_user = (OWNER_APP_NAME, OWNER_USER_ID) if mode == "owner" else (APP_NAME, USER_ID)
    booking = await _handle_booking_step(message, session_id, book_app, book_user)
    if booking is not None:
        return StreamingResponse(_logged(booking, message, session_id, mode), media_type="application/x-ndjson")

    # The in-app owner console (separate agent). Its card actions are handled
    # deterministically: /quote → price card, /confirm → write the reservation
    # directly through the guarded seam (no OTP — the owner is authenticated).
    # Everything else (incl. /book, which gathers guest name + phone) goes to the
    # owner agent.
    if mode == "owner":
        handled = await _handle_owner_slash(message, session_id)
        stream = handled if handled is not None else _run(
            message, session_id, _owner_runner, OWNER_APP_NAME, OWNER_USER_ID,
            fallback_runner=_owner_fallback_runner,
        )
        return StreamingResponse(_logged(stream, message, session_id, mode), media_type="application/x-ndjson")

    # Public guest widget: button actions (/quote, /confirm) are handled
    # deterministically without an LLM call; /confirm files a booking request
    # rather than creating a reservation. Everything else goes to the guest agent.
    handled = await _handle_slash(message, session_id, mode)
    stream = handled if handled is not None else _run(message, session_id, fallback_runner=_fallback_runner)
    return StreamingResponse(_logged(stream, message, session_id, mode), media_type="application/x-ndjson")


@api.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}
