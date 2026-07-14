# OTA Guest Assistant — ADK Python sidecar

The Gemini-powered brain behind the OTA app's `/assistant` chat. It's a **separate
Python process** in this monorepo (the Next.js app ships no LLM SDK). Its tools
call the PMS **only** through the `/api/agent/*` seam, so the database stays the
single source of truth and the GiST no-double-booking guarantee governs every
write. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#root-agent-seam).

```
ota_guest_agent/
  __init__.py            load .env, expose app + root_agent
  agent.py               App(...) + root_agent  (ADK entry point)
  core_agents/
    guest_agent.py       public LlmAgent — GUEST_TOOLS (read + propose-booking + FAQ)
    owner_agent.py       owner LlmAgent — adds OWNER_ONLY_TOOLS (briefing/queue/block/resolve/summary)
  prompts/
    blocks.py            shared SECURITY / ACCURACY / FORMATTING blocks + persona closings
    instruction.py       build_instruction() — async InstructionProvider composed per turn
  guardrails.py          assert_tool_isolation() — guest tools can never include owner-only tools
  tools/
    booking_tools.py     check_availability, quote_room, propose_booking, request_booking_change
    faq_tools.py         answer_faq — emits FAQ media cards
    owner_tools.py       daily_briefing, open_requests, block_room, resolve_request, business_summary
  services/
    ota_client.py        typed async client for /api/agent/*  (the only file with OTA URLs)
    policies.py          fetch owner-authored assistant policies (cached ~60s)
    dates.py             per-turn IST date grounding
    ui.py                generative-UI builders — EXACT shapes of src/lib/assistant/types.ts
  server.py              FastAPI POST /chat -> NDJSON StreamChunk; deterministic slash-flows + retry/fallback
```

## Status: live in production

Deployed on Cloud Run (`ota-guest-agent`, `asia-south1`) and serving both the
public guest widget and the owner console. The **AI architecture upgrade plan
(phases A–F)** is complete — 10 PRs, #136–#145. What that added on top of the
original read-only agent:

- **Resilience (A):** `_run` is a 3-attempt chain — primary → primary →
  `GEMINI_FALLBACK_MODEL` (default `gemini-2.5-flash`); empty or transient-error
  turns fall through, a partial-then-error stream keeps the partial, and only an
  all-fail turn emits a friendly message (never silence or a raw error).
- **Two personas (guardrails):** `guest_agent` (public) and `owner_agent` (owner),
  routed by `mode`, never sharing a session namespace. `guardrails.assert_tool_isolation()`
  runs at import so owner-only tools can never leak into the guest tool list.
- **Shared prompts (B/C):** one `prompts/blocks.py` for the SECURITY / ACCURACY /
  FORMATTING blocks; `build_instruction()` composes date → role → owner policies →
  formatting → accuracy → **security last (outranks everything)** per turn.
- **Runtime owner policies (D):** owners edit assistant behaviour from Settings →
  "Assistant rules"; `services/policies.py` injects them per turn (cached ~60s), so
  edits apply within a minute with no redeploy. Security block always outranks policy.
- **Diagnostics (C3):** each turn logs which tools ran, token count, and whether the
  fallback model was used, into the owner's chat log.
- **FAQ media (E1):** `answer_faq` can attach owner-curated photos / a map card.

Conversational LLM behaviour is verified live; the deterministic core is covered by
the pytest suite (below).

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

## Scope & the write path

The agent can read (availability, rooms, price) **and** move a booking forward — but
never writes blindly. The deterministic `/book → /bookdetails → /confirm` flow (no
LLM at the moment of commitment) drives it:

- **Public guest:** `/confirm` re-checks availability and files a **booking-request
  escalation** for the owner to approve — a guest never writes a reservation directly.
- **Owner console:** `/confirm` writes through the guarded `/api/agent/*` seam, so a
  GiST conflict (409) surfaces as "room just taken" and is never retried.

Cancel / modify / refund are **always** human escalations, never agent actions. The
demo OTP flow was removed (public confirm files an escalation instead).
