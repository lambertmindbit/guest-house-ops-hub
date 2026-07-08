# OTA Guest Assistant — ADK Python sidecar

The Gemini-powered brain behind the OTA app's `/assistant` chat. It's a **separate
Python process** in this monorepo (the Next.js app ships no LLM SDK). Its tools
call the PMS **only** through the `/api/agent/*` seam, so the database stays the
single source of truth and the GiST no-double-booking guarantee governs every
write. See `docs/AGENT-GENUI-PLAN.md`.

```
ota_guest_agent/
  __init__.py            load .env, expose app + root_agent
  agent.py               App(...) + root_agent  (ADK entry point)
  core_agents/
    guest_agent.py       the LlmAgent (Gemini) + instruction + tools
  tools/
    booking_tools.py     check_availability, quote_room  (Phase-2 read tools)
  services/
    ota_client.py        typed async client for /api/agent/*  (the only file with OTA URLs)
    ui.py                generative-UI builders — EXACT shapes of src/lib/assistant/types.ts
  server.py              FastAPI POST /chat -> NDJSON StreamChunk (what the OTA proxy calls)
```

## ⚠ Status: written, syntax-checked, NOT YET RUN

Per the agreed Phase-2 mode ("build now, wire the key + deploy later"), this
package is authored against the reference's ADK usage and passes `py_compile`, but
it has **not been executed** — there is no Gemini key or Python host in the build
environment. Before it will serve, verify against the installed `google-adk`
version + a real key:

- the ADK **Runner** streaming loop in `server.py` (`run_async` event/part shape),
- **session** lifecycle (`create_session` / `get_session` signatures, how
  `tool_context.state` surfaces as `session.state`),
- the **Gemini model** import path and retry options.

These are the spots most likely to need a small tweak for your ADK version; the
integration-specific code (tools → our endpoints, UI descriptor shapes, the
`/chat` NDJSON contract) is the stable part.

## Run locally

```bash
cd assistant-agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # fill in GEMINI_API_KEY + OTA_AGENT_TOKEN
uvicorn ota_guest_agent.server:api --port 8080
```

Then point the OTA app at it (in the OTA app's `.env` / Vercel):

```
ASSISTANT_AGENT_URL="http://localhost:8080/chat"   # or your deployed host
ASSISTANT_AGENT_TOKEN="…"                           # optional; must match this side
```

With those set, the OTA `/assistant` page streams from this agent; unset (or if
this server is down), it falls back to the built-in Phase-1 stub — production
never breaks.

Explore the agent directly with the ADK dev UI:

```bash
adk web --reload_agents --port 8001 assistant-agent
```

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q          # fast: no network, no LLM, no API key
```

The suite (`tests/`) faces the deterministic core — the `/book → /bookdetails →
/confirm` slash-flows in both modes and the empty-turn retry chain — with a faked
seam (`server._ota`) and faked runners. It runs in CI as the `agent-tests` job.
Conversational LLM turns are verified live, not in CI.

## Deploy & scaling — MUST stay single-instance

Sessions (conversation history + the in-flight `_pending` booking) live in this
process's memory via ADK's `InMemorySessionService`. **The Cloud Run service must
therefore run at most one instance** — a second instance would serve a guest's
follow-up turn from a different memory and lose their pending booking mid-flow.

```bash
gcloud run deploy ota-guest-agent --source . --region asia-south1 --quiet
gcloud run services update ota-guest-agent --region asia-south1 --max-instances=1
```

To scale past one instance, swap `InMemorySessionService` for a persistent
(DB-backed) ADK session service first. Tracked as decision D1 in the AI
architecture upgrade plan.

## Scope

Phase 2 is **read-only** (availability, rooms, price). The booking write
(`create_reservation`), OTP flow, and escalation/message tools are Phase 3 — the
`OtaClient` already has those methods; the agent just isn't given them yet.
