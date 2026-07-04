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
from google.adk.runners import Runner  # noqa: E402
from google.adk.sessions import InMemorySessionService  # noqa: E402
from google.genai import types  # noqa: E402

from .core_agents.guest_agent import guest_agent  # noqa: E402

APP_NAME = "ota_guest_agent"
USER_ID = "guest"

api = FastAPI(title="OTA Guest Assistant")
_session_service = InMemorySessionService()
_runner = Runner(app_name=APP_NAME, agent=guest_agent, session_service=_session_service)


def _line(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False) + "\n"


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

    return StreamingResponse(_run(message, session_id), media_type="application/x-ndjson")


@api.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}
