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

import hmac
import json
import logging
import os
import re
import time
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
from .guardrails import assert_tool_isolation  # noqa: E402
from .services.ota_client import OtaClient, OtaError, RoomJustTaken, current_property_ref  # noqa: E402
from .services import ui  # noqa: E402

# Refuse to start if the public guest agent was ever wired with an owner tool.
assert_tool_isolation()

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


def _make_session_service():
    """Choose where session state (conversation + pending-booking `_pending`) lives.

    Default — InMemorySessionService: state lives in THIS process's memory, which
    makes the service stateful and forces `--max-instances=1` (a second instance
    would serve a guest's follow-up turn from different memory and lose their
    pending booking). This is the safe default and needs no extra infra.

    Opt-in — set SESSION_DB_URL to an async SQLAlchemy URL (e.g.
    `postgresql+asyncpg://…`) and sessions persist in that database and are shared
    across instances, so the single-instance pin can be lifted. Enabling it is an
    infra decision (provision/point a DB, add the secret, `pip install` the async
    driver + SQLAlchemy, then raise max-instances) — see decision D1 in the
    architecture upgrade plan. The DatabaseSessionService import is lazy so the
    default path never needs SQLAlchemy installed.
    """
    url = os.getenv("SESSION_DB_URL")
    if not url:
        return InMemorySessionService()
    from google.adk.sessions import DatabaseSessionService  # lazy: needs SQLAlchemy

    logger.info("Using DatabaseSessionService (persistent sessions; multi-instance safe)")
    return DatabaseSessionService(db_url=url)


_session_service = _make_session_service()
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

# ── Session eviction ─────────────────────────────────────────────────────────
# InMemorySessionService keeps every session's full event history in this
# process's RAM forever. The public widget mints a fresh session per guest, so
# without eviction memory grows monotonically until the (single, pinned) instance
# restarts. We track last-seen per session and, opportunistically on each request,
# drop sessions idle past a TTL. Web chat is short-lived, so a couple of hours is
# ample; a returning guest just starts a fresh session (their client keeps the id,
# and a missing session is recreated cleanly by the flow).
SESSION_TTL_SECONDS = float(os.getenv("SESSION_TTL_SECONDS", str(2 * 60 * 60)))
_session_last_seen: dict[tuple[str, str, str], float] = {}


async def _touch_and_evict(app_name: str, user_id: str, session_id: str) -> None:
    """Record activity for this session and evict any idle past the TTL."""
    now = time.monotonic()
    _session_last_seen[(app_name, user_id, session_id)] = now
    if len(_session_last_seen) <= 1:
        return
    stale = [key for key, seen in _session_last_seen.items() if now - seen > SESSION_TTL_SECONDS]
    for key in stale:
        _session_last_seen.pop(key, None)
        try:
            await _session_service.delete_session(app_name=key[0], user_id=key[1], session_id=key[2])
        except Exception:  # best-effort — never fail a request on cleanup
            pass


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


async def _confirm_pending(session_id: str, mode: str) -> AsyncIterator[str]:
    """The single /confirm implementation for BOTH modes. propose_booking (or the
    /bookdetails form) stashed the booking as `_pending` in this mode's session.

    mode="public": re-check availability, then file a booking-REQUEST escalation —
        NO reservation is created (an anonymous guest can never confirm a booking).
    mode="owner":  write the reservation DIRECTLY through the guarded seam (the
        owner is authenticated); a GiST 409 -> RoomJustTaken is surfaced, never
        retried."""
    app_name, user_id = (OWNER_APP_NAME, OWNER_USER_ID) if mode == "owner" else (APP_NAME, USER_ID)
    session = await _session_service.get_session(app_name=app_name, user_id=user_id, session_id=session_id)
    pending = (dict(session.state) if session else {}).get("_pending")
    if session is None or not pending:
        yield _line({"type": "text", "delta": "I don't have a booking ready to confirm — let's start again with your dates."})
        yield _line({"type": "done"})
        return

    # Claim this confirmation up front: clear _pending immediately so a duplicate
    # /confirm (a fast double-tap, or a reconnect that resends) finds nothing to
    # confirm instead of filing a second request / attempting a second write. If a
    # TRANSIENT error below means the guest should be able to retry, we restore it.
    await _set_state(session, {"_pending": None})

    if mode == "public":
        # Last-moment re-check — the guest may have spent a while on the form.
        # Catching it here means "sorry, that's gone" arrives as part of booking,
        # not days later when the owner tries to approve a request that can no
        # longer be honoured.
        if not await _room_still_free(pending["roomId"], pending["checkIn"], pending["checkOut"]):
            # _pending already cleared above — the room's gone, don't offer a retry.
            yield _line({"type": "text", "delta": f"Sorry — {pending['roomLabel']} is no longer available for those dates. Want to check other options?"})
            yield _line({"type": "done"})
            return

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
            # Transient — let the guest retry: put the pending booking back.
            await _set_state(session, {"_pending": pending})
            yield _line({"type": "text", "delta": f"I couldn't send your request ({exc}). Please try again."})
            yield _line({"type": "done"})
            return
        # _pending already cleared above.
        yield _line({"type": "text", "delta": f"Thank you, {pending['guestName']}! 🙏 I've sent your request for {pending['roomLabel']} ({pending['checkIn']} → {pending['checkOut']}) to the property. They'll confirm availability and reach you on {pending['guestPhone']} shortly."})
        yield _line({"type": "done"})
        return

    # mode == "owner": write the reservation directly through the guarded seam.
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
        # _pending already cleared above.
        yield _line({"type": "text", "delta": f"Those dates are no longer free for {pending['roomLabel']} — it was just booked. Want to try other dates or another room?"})
        yield _line({"type": "done"})
        return
    except OtaError as exc:
        # Transient — let the owner retry: put the pending booking back.
        await _set_state(session, {"_pending": pending})
        yield _line({"type": "text", "delta": f"I couldn't complete the booking ({exc})."})
        yield _line({"type": "done"})
        return

    # _pending already cleared above.
    yield _line({"type": "text", "delta": f"✅ Booked! #{reservation.get('id')} — {pending['roomLabel']}, {pending['checkIn']} → {pending['checkOut']} for {pending['guestName']} ({pending['guestPhone']}), ₹{pending['total']}."})
    yield _line({"type": "done"})


async def _handle_owner_slash(message: str, session_id: str):
    """Deterministic owner-console card actions — NO LLM call.
    /quote → price card. /confirm → write the reservation directly (see
    _confirm_pending, mode="owner"). Returns an async generator, or None."""
    msg = message.strip()
    if msg.startswith("/quote"):
        return _quote_lines(msg)
    if msg.startswith("/confirm"):
        return _confirm_pending(session_id, "owner")
    return None


async def _handle_slash(message: str, session_id: str):
    """Deterministic public-widget card actions — NO LLM call (faster, cheaper,
    immune to model overload on these steps). /quote → price card; /confirm →
    file a booking REQUEST (see _confirm_pending, mode="public") — never a
    reservation, since an anonymous guest can't confirm a booking. Returns an
    async generator, or None."""
    msg = message.strip()
    if msg.startswith("/quote"):
        return _quote_lines(msg)
    if msg.startswith("/confirm"):
        return _confirm_pending(session_id, "public")
    return None


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
        is_fallback = fallback_runner is not None and attempt_runner is fallback_runner
        # Fresh per-turn _ui bucket (also clears any UI a prior empty attempt left).
        # On an existing session the reset MUST go through _set_state (an event
        # with a state delta) — mutating the get_session() snapshot silently does
        # nothing, which live meant every past room card was re-emitted on every
        # later turn of the conversation.
        try:
            await _session_service.create_session(app_name=app_name, user_id=user_id, session_id=session_id, state={"_ui": []})
        except Exception:
            session = await _session_service.get_session(app_name=app_name, user_id=user_id, session_id=session_id)
            if session is not None and session.state.get("_ui"):
                await _set_state(session, {"_ui": []})

        emitted = False
        tools: list[str] = []   # which LLM tools this attempt called (for the chat log)
        tokens = 0              # best-effort total token count (cumulative on the last event)
        content = types.Content(role="user", parts=[types.Part(text=message)])
        try:
            async for event in attempt_runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
                usage = getattr(event, "usage_metadata", None)
                total = getattr(usage, "total_token_count", None) if usage is not None else None
                if isinstance(total, int):
                    tokens = max(tokens, total)
                parts = getattr(getattr(event, "content", None), "parts", None) or []
                for part in parts:
                    fc = getattr(part, "function_call", None)
                    fname = getattr(fc, "name", None) if fc is not None else None
                    if fname:
                        tools.append(fname)
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
            # Stash per-turn diagnostics for the chat log; _logged drains this.
            if session is not None:
                await _set_state(session, {"_diag": {"tools": tools, "tokens": tokens, "fallback": is_fallback}})
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
        body: dict = {"sessionId": session_id, "mode": mode, "userMessage": message, "reply": reply}
        # Attach per-turn diagnostics (which tools ran, tokens, fallback) if _run
        # stashed any this turn — then clear it so it can't leak into the next
        # (deterministic) turn's log. Deterministic flows set no _diag → omitted.
        app_name, user_id = (OWNER_APP_NAME, OWNER_USER_ID) if mode == "owner" else (APP_NAME, USER_ID)
        try:
            sess = await _session_service.get_session(app_name=app_name, user_id=user_id, session_id=session_id)
            diag = (dict(sess.state).get("_diag") if sess else None)
            if diag:
                md: dict = {}
                if diag.get("tools"):
                    md["tools"] = diag["tools"]
                if diag.get("tokens"):
                    md["tokens"] = diag["tokens"]
                if diag.get("fallback"):
                    md["fallback"] = True
                if md:
                    body["metadata"] = md
                await _set_state(sess, {"_diag": None})
        except Exception:
            pass
        try:
            await _ota.log_turn(body)
        except Exception:
            pass


@api.post("/chat")
async def chat(request: Request, authorization: str | None = Header(default=None)) -> StreamingResponse:
    # Fail CLOSED: without a configured token the endpoint refuses all traffic
    # (matches the app-side seam). Constant-time compare avoids a token timing leak.
    expected = os.getenv("ASSISTANT_AGENT_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="agent auth not configured")
    got = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(got, expected):
        raise HTTPException(status_code=401, detail="unauthorized")

    body = await request.json()
    message = (body or {}).get("message", "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="message is required")
    session_id = (body or {}).get("sessionId") or f"web-{uuid.uuid4().hex}"
    # Default to the least-privileged guest agent; owner mode requires an explicit
    # opt-in (the app's owner transport sends it). Never fall into owner by default.
    mode = "owner" if (body or {}).get("mode") == "owner" else "public"

    # The property this whole conversation is about. Owner mode: the owner's current
    # property (sent by the app). Public mode: the property whose website the widget
    # is embedded on. Set it into the request context so every OtaClient read scopes
    # to it (services/ota_client.current_property_ref). Set here — before the awaited
    # booking fast-path AND the streamed agent run, all within this one request task,
    # so both see it. None → the seam's sole-property fallback (single-property client).
    current_property_ref.set((body or {}).get("propertyId") or None)

    # The Book button flow (/book → name/phone form → /bookdetails → confirm card)
    # is fully deterministic in BOTH modes — no LLM, so the room list is never
    # re-rendered. Pending is stored in this mode's session namespace so /confirm
    # (below) reads it back.
    book_app, book_user = (OWNER_APP_NAME, OWNER_USER_ID) if mode == "owner" else (APP_NAME, USER_ID)
    # Mark this session active + sweep idle sessions so memory can't grow forever.
    await _touch_and_evict(book_app, book_user, session_id)
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
    handled = await _handle_slash(message, session_id)
    stream = handled if handled is not None else _run(message, session_id, fallback_runner=_fallback_runner)
    return StreamingResponse(_logged(stream, message, session_id, mode), media_type="application/x-ndjson")


@api.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}
