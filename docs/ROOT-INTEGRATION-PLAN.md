# ROOT ⇄ OTA Integration Plan — wiring the ADK agents to the PMS

**Status:** approved plan, implementation not started
**Date:** 2026-07-04
**Companion docs:** `docs/ROOT-INTEGRATION-HANDOFF.md` (the architecture contract — already fully implemented on the OTA side), `docs/ORG-DESIGN.md`
**ROOT code reference:** `/Tourism Agent` drop (partial extract of the `whatsapp_api` repo)

---

## 0. Decisions locked (2026-07-04)

| # | Decision | Choice |
|---|---|---|
| Q1 | Channel attribution for agent bookings | **Seed a dedicated "Assistant (ROOT)" channel** (0% commission) |
| Q2 | Room identity across the seam | **ROOT's rooms table gains `ota_room_id` (the PMS cuid); tools speak cuids; OTA adds a read-only `GET /api/agent/rooms` catalog.** Room *content* (photos, descriptions, FAQ) stays ROOT-side |
| Q3 | Admin/console (playground) agent | **Defer to P6** — dashboards stay on ROOT's DB (demo-only); its *write* tools are re-pointed to escalations in P4 regardless |
| Q4 | Historical ROOT bookings | **One-time conflict-checked import** into the PMS at cutover (existing CSV-import path, GiST-checked per row) |

---

## 1. The problem in one sentence

ROOT's agents currently read rooms, check availability, and **write bookings into
their own Supabase database** (`db_service.create_guesthouse_booking(tenant_id=2, …)`)
— a second source of booking truth running in parallel with the PMS. Two guests
can book the same room on the same night, one through each system, and neither
will know. The integration is not a feature add: it is **rewiring ROOT's
transactional tools to call the OTA agent seam**, so the GiST no-double-booking
constraint governs every booking regardless of which door the guest used.

ROOT keeps what it is good at — conversation (FSM state machine), GenUI room
cards (`ui_config_list`), the confirm-before-book flow (`request_confirmation`),
the resilient Gemini fallback stack, WhatsApp/webchat plumbing, room content —
and stops keeping booking state, exactly as the handoff prescribed ("the agents
never hold booking state of their own").

## 2. What the ROOT drop contains (read 2026-07-04)

- **`agent/tenant_2_agent.py`** — guest-facing agent. Tools: `respond_to_customer`,
  `idle`, `rooms_book`, `rooms_check_availability`, `rooms_get_details`,
  `faq_get_answers`, `create_ticket_for_admin`. FSM state tracking, GenUI config
  list, tool-confirmation HITL flow, 10-digit phone validation, double
  availability check around confirmation. All data ops via `get_database_service()`
  → ROOT's own Supabase (`rooms` with integer ids + `room_photos`,
  `create_guesthouse_booking`, `check_room_availability`).
- **`agent/playground_agent.py`** — owner console agent: NL→SQL dashboard builder
  over `PLAYGROUND_TABLES`, `delete_bookings`, `update_room_status`, workflow
  tracking. Confirmation-gated writes — but direct DB writes nonetheless.
- **`agent/resilient_llm_agent.py`, `google_genai_wrapper.py`, `litellm_wrapper.py`,
  `google_genai_service.py`** — model resilience infra (primary flash-lite →
  fallback 2.5-flash, retries, model restore). Reused as-is.
- **`agent-admin/`** — React/Vite admin chat UI over SSE
  (`POST /admin/admin-agent` on the FastAPI `whatsapp_api` backend).
- **Not in the drop** (imported but missing): `supabase_db/database_service`,
  `cab_booking_agent`, `playground_tables/ui/tools/sql_security`, `models/`,
  `utils/`, the FastAPI backend. **Implementation happens in the full
  `whatsapp_api` repo; this folder is contract reference only.**

## 3. Tool-by-tool mapping

| ROOT tool (today) | Becomes | Status |
|---|---|---|
| `rooms_check_availability` (per-room, own DB) | `GET /api/agent/availability` — derived, GiST-consistent. Seam is per room-*type*; ROOT is per-room → **extend seam with room-level check** | Seam gap → P1 |
| price = nights × `price_per_night` (own table) | `GET /api/agent/quote?roomId` — live advisory rate (seasons/weekend/lead-time) | Ready |
| `rooms_book` final write (`create_guesthouse_booking`) | `POST /api/agent/reservations` — guest upsert + confirmed booking through the guarded path; **409 → "just taken" conversation turn** with alternatives. Channel = "Assistant (ROOT)" (Q1) | Ready |
| `create_ticket_for_admin` | `POST /api/agent/escalations` (source `assistant`, stable `externalId` for dedupe) → owner's `/escalations` HITL queue | Ready |
| Outbound guest replies (WhatsApp/webchat) | Also logged via `POST /api/agent/messages` → owner's Messages / guest CRM thread | Ready |
| `rooms_get_details`, semantic search, photos, FAQ | **Content stays ROOT-side**; ids/rates/active-state grounded via new `GET /api/agent/rooms` + `ota_room_id` mapping (Q2) | Seam gap → P1 |
| `playground_agent.delete_bookings` | **Must never point at the PMS** — cancellation is HITL-only (sacred rule). Becomes "file a cancellation escalation" | HITL conflict → P4 |
| `playground_agent` NL→SQL dashboards, `update_room_status` | Stay on ROOT's DB, demo-only (Q3). Read-path decision deferred to P6 | Defer |
| `cab_booking_agent` (missing from drop) | Optional later: `/api/agent/trips` over the OTA Transport module | Later (P6) |

**Hard rule carried into every phase:** no ROOT code path may create, modify, or
delete a PMS booking except `POST /api/agent/reservations` (simple,
guest-confirmed bookings). Everything else files an escalation.

## 4. New piece on the ROOT side — `ota_client` + ADK packaging

One typed HTTP client wraps the whole seam (httpx `AsyncClient`, already a ROOT
dependency): `x-agent-token` injection, the `{data}/{error}` envelope, timeouts,
one retry on 5xx (never on 409), and `409 → RoomJustTaken` so tools translate it
into conversation. `database_service` keeps serving content only.

Packaged per the ADK worker_agent entry-point convention:

```
agent/worker_admin/worker_app/ota_guest_agent/
  __init__.py                 # load .env (OTA_BASE_URL, OTA_AGENT_TOKEN, SERVER_URL), then import agent
  agent.py                    # app = App(name="ota_guest_agent", root_agent=…); exports root_agent
  core_agents/guest_agent.py  # tenant_2_agent's FSM/GenUI/confirm flow, tools rewired to the seam
  services/ota_client.py      # the seam client — the ONLY file that knows OTA URLs
  services/…                  # GoogleGenAIWrapper / ResilientLlmAgent reused as-is
```

Run: `adk run agent/worker_admin/worker_app/ota_guest_agent` /
`adk web --reload_agents --port 8001 agent/worker_admin/worker_app`.

A `USE_OTA_SEAM` env flag lets each tool fall back to the legacy DB path during
the transition, so the demo never breaks mid-migration.

## 5. Small additions on the OTA side (all additive, token-gated)

1. **`GET /api/agent/rooms`** — catalog: id, label, room type, max occupancy,
   base/advisory rate, active. Read-only wrap of existing lib.
2. **Room-level availability** — `roomId` support on `/api/agent/availability`
   (or a `roomIds + range → free/busy` check) reusing the derived logic.
3. **"Assistant (ROOT)" channel** — seeded, 0% commission (Q1).

Nothing touches the correctness core; no schema change beyond one channel row.
Standard route recipe: Zod, `ok/fail`, `agentTokenOk`.

## 6. Phases (one PR each, CI-gated; demo never broken)

| Phase | Side | Work |
|---|---|---|
| **P1** | OTA | Seam completion: catalog endpoint, room-level availability, Assistant channel seed. Contract tests (401 without token; room-level agrees with type-level availability). |
| **P2** | ROOT | ADK package skeleton + `ota_client`. Rewire **reads** behind `USE_OTA_SEAM`: availability, quote, room ids/rates from catalog. Add `ota_room_id` mapping. |
| **P3** | ROOT | The booking write moves: `rooms_book` → `POST /api/agent/reservations`; 409 handled conversationally; `create_guesthouse_booking` retired behind the flag. **No dual-write.** |
| **P4** | Both | Escalations + message log: tickets → `/api/agent/escalations` (externalId dedupe); replies → `/api/agent/messages`; `delete_bookings` re-pointed to escalation filing. |
| **P5** | Both | Cutover: flag on for good; ROOT bookings tables read-only legacy; one-time conflict-checked import of historical bookings (Q4). E2E demo proof: web-chat books → OTA calendar → double-book attempt → 409 → alternative → cancellation request → `/escalations` → owner resolves. |
| **P6** | Optional | Cab agent → `/api/agent/trips`; playground read-path decision executed. |

## 7. Risks

- **Latency/cold starts:** each tool call is an HTTPS hop to Vercel serverless —
  invisible next to multi-second LLM turns, but the client needs timeouts + one
  5xx retry (never 409).
- **Partial drop:** this folder can't run standalone; implementation lands in
  the full `whatsapp_api` repo.
- **Token secrecy:** `OTA_AGENT_TOKEN` grants booking-create rights — ROOT
  server env only; never in the Vite admin UI (`VITE_*` ships to the browser).

## 8. Assumptions

- ROOT "tenant 2" **is** Lawei / this OTA deployment (code references
  laweihomestay.com); single-property for this work (`propertyRef` stays the
  forward-compat hook).
- Agent bookings are **created confirmed** through the guarded path,
  guest-confirmed via ROOT's existing confirm/OTP flow (handoff's default).
- WhatsApp/webchat FastAPI plumbing untouched — integration is inside the tools.
- The OTA app stays free of any LLM SDK (sacred scope rule); all agent brains
  live ROOT-side.
