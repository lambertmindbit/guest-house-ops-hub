# Agentic + Generative UI — in-repo build plan

**Status:** ✅ **built and in production.** This is the plan it was built from,
kept for the reasoning; it is no longer a to-do list. The generative-UI registry
(`src/components/assistant/registry.tsx`), the NDJSON `StreamChunk` protocol and
the Python ADK sidecar (`assistant-agent/`) all shipped. For what exists now, read
[ARCHITECTURE.md](ARCHITECTURE.md) and [ROADMAP.md](ROADMAP.md).
**Date:** 2026-07-04 (status corrected 2026-07-14)
**Supersedes:** the earlier ROOT-integration docs, which assumed the conversational
LLM agent would be a *separate* ROOT service and that no LLM SDK belonged in this
repo. That direction was reversed and those docs have since been deleted; the
shipped `/api/agent/*` seam remains the tool contract — see below.
**Reference (inspiration only):** `/Tourism Agent` — `tenant_2_agent.py` (guest),
`playground_agent.py` (owner console), the resilient LLM stack, `agent-admin` GenUI.

---

## 0. Decisions locked (2026-07-04)

| # | Decision | Choice |
|---|---|---|
| Q1 | Where the agent brain runs | **ADK Python sidecar in the monorepo.** Tools call our `/api/agent/*` HTTP endpoints; the Next app ships **no** LLM SDK |
| Q2 | Which agent first | **Guest booking assistant** (tenant_2 style) |
| Q3 | LLM provider | **Gemini** — flash-lite primary → 2.5-flash fallback, matching the reference's resilient stack |
| Q4 | Guest verification / delivery | **Demo-mode OTP now** (echoed/on-screen); real WhatsApp send stays the flagged BSP follow-up |
| Q5 | Where the guest chat lives | **In-app `/assistant` page first** (no CORS; easy demo); embeddable widget later |

### Deliberate rule reversal (on the record)
The handoff kept the LLM agent out of this repo. This work **brings it in** as a
co-located Python package. The reconciliation that keeps the spirit intact:
- The **Next.js app** still ships no LLM SDK — the brain is a separate Python
  process, just in the same monorepo.
- Every other sacred rule is **untouched**: bookings only through the guarded
  create path (GiST 409), availability stays derived, migration discipline,
  no OTA scrapers. Cancel/refund/delete remain **escalations**, never tool writes.

---

## 1. Architecture

Three layers; the DB is unchanged truth.

```
┌ Chat + GenUI ───────────────────────────────  Next.js / React (NEW)
│   /assistant page · streaming transport · component registry
│   renders assistant UI descriptors {type,data} → room cards, quote,
│   confirm card, availability grid — on the existing ui.tsx design system
├ Agent runtime ─────────────────────────────  ADK Python sidecar (NEW)
│   /agent/… worker_agent entry-point shape · Gemini resilient stack ·
│   FSM/turn logic · tools rewired to OUR contracts
├ Tool → contract ───────────────────────────  mostly SHIPPED (P1 seam)
│   a booking is ONLY created via POST /api/agent/reservations (→409)
└ System of record ──────────────────────────  Postgres (UNCHANGED)
    no agent state store, no parallel bookings table
```

- **Deploy:** Next.js on Vercel (as today); the Python agent on a Python host
  (e.g. Cloud Run). A Next.js streaming route proxies the browser ↔ agent so the
  agent URL/token never reaches the client.
- **Packaging (per your ADK workflow):** the agent follows the `worker_agent`
  entry-point convention — `__init__.py` (load `.env`) → `agent.py`
  (`app = App(...)`, exports `root_agent`) → `core_agents/…` orchestration →
  `services/ota_client.py` (the only file that knows OTA URLs).

## 2. Tool → endpoint map (≈6 of 9 already shipped)

| Reference tool | Our contract | State |
|---|---|---|
| `rooms_check_availability` | `GET /api/agent/rooms/availability` | Shipped (P1) |
| `rooms_get_details` (ids/rates) | `GET /api/agent/rooms` | Shipped (P1) |
| price = nights × rate | `GET /api/agent/quote` | Shipped |
| `rooms_book` (confirm → write) | `POST /api/agent/reservations` (Assistant channel `cmr6b9eio…`) | Shipped |
| `create_ticket_for_admin` | `POST /api/agent/escalations` | Shipped |
| outbound reply logging | `POST /api/agent/messages` | Shipped |
| `faq_get_answers` | `GET /api/agent/faq` (owner-managed FAQ) | **New, small** |
| `rooms_search_semantic` | defer — needs embeddings/pgvector | **Deferred** |
| console `delete_bookings` | files a cancellation **escalation** (HITL) | Re-point |
| console NL→SQL dashboards | read wrappers over analytics/finance libs | New (Phase 5) |

The genuinely new backend surface is small: an FAQ contract, and (console only)
read wrappers. Semantic search is deferred; start with structured catalog search.

## 3. Generative UI

The reference streams messages and renders a `ui_config_list` (`{type,data}`)
plus a `confirmation` object (confirm-booking → OTP). We rebuild that pattern on
**our** design system:
- A **component registry**: `type → React component`, e.g. `rooms` → a room-card
  grid built from `ui.tsx` primitives; `quote` → a price card; `confirm_booking`
  → a confirm card; `availability` → a compact grid.
- The `/assistant` page streams assistant turns (text + descriptors) and renders
  them inline; confirm/OTP actions POST back through the proxy route.
- Mobile-first, PWA-consistent, no new UI kit — reuse tokens + `ui.tsx`.

## 4. Phases (each a PR; demo never breaks)

| Phase | Work |
|---|---|
| **1** | **GenUI foundation** — `/assistant` chat route + streaming transport + component registry rendering room/quote/confirm cards, driven by a **stub** agent (canned tool outputs). Full UI proven at zero LLM cost. |
| **2** | **Agent runtime + read tools** — stand up the ADK sidecar (Gemini); rewire read tools (availability, rooms, quote, FAQ) to our endpoints. Assistant answers "what's free next weekend and how much" with real cards. No writes. |
| **3** | **Booking write + confirm/OTP** — `rooms_book` → confirm card → `POST /api/agent/reservations`; 409 → graceful "just taken" turn; **demo-mode OTP** (Q4). |
| **4** | **Escalations + conversation log** — ticket tool → `/api/agent/escalations`; each turn logged to `/api/agent/messages` (owner sees the CRM thread); cancel/refund → escalation. |
| **5** | **Owner console agent (optional next)** — playground-style NL over analytics/finance libs; writes strictly as escalations; owner-auth. |

## 5. New OTA-side contracts needed

1. **`GET /api/agent/faq`** — owner-managed FAQ entries (token-gated read). Likely
   a small `FaqEntry` table + CRUD in Settings (additive migration).
2. **Streaming proxy route** — `/api/assistant/*` (owner/guest-appropriate auth)
   that forwards to the Python agent and streams back; keeps the agent
   URL/`AGENT_TOKEN` server-side.
3. (Phase 5) read wrappers exposing analytics/finance to the console agent.

## 6. Still needed from the maintainer (when we reach each)

- **Gemini API key + billing** (Phase 2) — into the agent's env, never the Next app.
- **Python host** for the sidecar (Cloud Run or similar) — for deploy, not local dev.
- **`AGENT_TOKEN`** in local `.env` (already in Vercel) for end-to-end testing.
- Room content (photos/descriptions) source for the cards — reuse ROOT's assets,
  or add minimal content fields to the PMS (decide at Phase 1).

## 7. Assumptions

- Single-property (Lawei); `propertyRef` stays the forward-compat hook.
- The reference agents are inspiration; tools/prompts are rewritten to our schema
  and endpoints, editing agent logic freely to fit our data points.
- The GiST/derived-availability/migration sacred rules hold; the only reversal is
  the "separate service / no LLM SDK" clause, consciously and recorded here.
