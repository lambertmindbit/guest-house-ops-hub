# ROOT Integration Handoff — for Claude Code

> **Place this file at `docs/ROOT-INTEGRATION-HANDOFF.md` in the repo.** The
> kickoff prompt references it by that path. It is the single source of truth
> for this body of work. Read it fully before planning anything.

---

## 0. How to use this document

This is a **plan-first** engagement, matching the workflow already used in this
repo (see the prompt at the end of `docs/DESIGN-HANDOFF.md`):

1. Read this handoff, then `CLAUDE.md`, `docs/ARCHITECTURE.md`,
   `docs/CONTRIBUTING.md`, and `escalation-module/INTEGRATION.md`. **Write no
   code yet.**
2. Produce a written plan: restate the sacred rules in your own words, restate
   what is in/out of scope, propose a phase-by-phase branch/PR breakdown, and
   list every assumption and open question.
3. **Wait for the maintainer's approval.** Then implement phase by phase, one
   branch/PR each, running `npm run lint && npx tsc --noEmit && npm test` before
   every PR, and using `npm run db:migrate:new` for any schema change.

If at any point a task seems to require breaking a sacred rule (§2), starting
multi-tenancy (§3 — out of scope), adding a heavy dependency, or faking a feature
to look finished — **stop and ask.** Do not work around it.

---

## 1. What the project is becoming

The repo today is a **single-property guest-house Operations Hub** — a
production PMS (bookings, calendar, derived availability, advisory pricing, CRM,
finance) that the owner controls. It is **not** a channel manager.

It is being consolidated into **ROOT** (Regional Orchestration Of Tasks — MindBit
Solutions' platform; see the DPR). The arc:

> *Paper register today → this operational backbone that already runs the
> business → AI agents that multiply it, in Khasi → a community network between
> properties.*

The guiding architecture (already agreed — don't re-litigate it):

- **The PMS is the single system of record.** The database is truth.
- **The AI agents are a separate service that transacts through this app's
  API** — they read freely, write only through the existing guarded paths, and
  never hold booking state of their own.
- **Sensitive actions are escalations, not agent actions.** Cancel / refund /
  blacklist are filed to a human-in-the-loop (HITL) queue; a human commits them.

This work makes that real **for a single property, demo-ready**. The full
conversational LLM agent and full multi-tenancy are explicitly **out of scope**
for this body of work (§3) — but everything here must keep their path open.

---

## 2. SACRED RULES — do not break (highest priority)

These come from `CLAUDE.md` / the project handoff and govern everything below.
If a feature seems to need violating one, the feature has a bug — stop and ask.

1. **Never weaken or remove the `no_overlapping_confirmed_stays` GiST exclusion
   constraint.** It is the single most valuable thing in the codebase. Two
   confirmed reservations for the same physical room must remain impossible at
   the DB level. **Every new booking path — including the agent's — must flow
   through the existing reservation-create domain logic so it inherits the
   409 conflict check.** No new booking-creation code that bypasses it.
2. **Availability is always derived** from reservations + blocks, never stored as
   a mutable counter. Any "free rooms" number is a correctness bug.
3. **Migration discipline.** The generated `daterange` columns + GiST constraint
   break under `prisma migrate dev`. **Always** use `npm run db:migrate:new
   <name>` (review) then `--apply`. Never `prisma migrate dev`. All new migrations
   are **additive** (new nullable columns / new tables) so they deploy without
   downtime.
4. **No scrapers / browser automation against OTA extranets, and no direct
   Booking.com / Agoda / MakeMyTrip APIs.** Not available to a single property.
   Ingestion stays via owner inbox + iCal only.
5. **Never commit secrets.** New secrets go in `.env.example` as placeholders and
   in the deployment env, never in code.
6. **Ask before adding heavy dependencies or new services.** The stack is
   deliberately minimal. An LLM SDK, a messaging SDK, an auth library — all
   require a flag-and-confirm before adding.

Also keep the existing **conventions** (see `docs/CONTRIBUTING.md`): domain logic
in `src/lib/*`; `{ data }` / `{ error }` envelope via `ok`/`fail`/`zodFail`; Zod
at the top of every route; reads in Server Components via lib→Prisma, writes via
`"use client"` island → `/api` → lib → `router.refresh()`; mobile-first ~390px;
reuse the design-system classes + `src/components/ui.tsx` primitives; money is
whole-rupee `number` at the boundary; dates date-only, UTC-anchored, half-open.

---

## 3. Scope — in and out

### In scope (build this, single-tenant, demo-ready)

| # | Work | One-liner |
|---|------|-----------|
| A | **Integrate the escalation module** | The HITL inbox + the agent seam. Files are already authored in `escalation-module/` — wire them in, don't rebuild. |
| B | **Agent API seam** (`/api/agent/*`, token-gated) | The contract the ROOT bot calls to read availability/pricing, create simple bookings through the guarded path, and file escalations. |
| C | **Foreigner registration (C-Form) capture** | Guest/check-in fields + a printable record. Compliance gap surfaced by discovery (Lawei hosts foreigners). |
| D | **Scam-number list + payment-verification checklist** | Owner's flagged-numbers list and a "verify with bank" gate at advance-payment time. (Single-property now; shared version is deferred — see below.) |
| E | **Advance-payment request tracking** | Surface expected advance + paid/pending against a reservation, tied to D. |
| F | **Messaging outbox abstraction** | A provider-agnostic notification seam (booking confirmation, reminder, payment request) with a **log/no-op adapter now**. Real WhatsApp/SMS adapter is a later, flagged step (needs a BSP — §5). |

### Explicitly OUT of scope (do NOT start; flag if a task drifts toward these)

- **The conversational LLM agent itself** (Khasi NLU, GenUI room cards, OTP
  conversation). It is a **separate ROOT service** that consumes the §B API. This
  repo provides the contracts, not the brain. Do **not** add an LLM SDK here.
- **Multi-tenancy + real auth/roles.** This is the major gate for "any homestay
  owner," the community network, and Direction B — it is its own dedicated piece
  of work, done deliberately later. Keep the path open (the escalation module
  already stubs `property_id`; new tables should add a nullable `property_id` the
  same way and new agent contracts should accept an optional `propertyRef`) but
  **build single-tenant** and do not refactor existing queries for tenancy now.
- **The community network** (overflow referrals, shared scam list, shared
  availability, bad-guest alerts). Inherently cross-property → waits on tenancy.
  Build only the **single-property** seed of the scam list in §D.
- **Real OTA push/pull / channel-manager (Direction B), real WhatsApp send,
  server-side PDF.** Deferred per the existing roadmap.

### Feedback → disposition (so nothing is hand-waved)

Every discovery item was considered; here's where each landed.

| Discovery feedback (Lawei + review) | Disposition |
|-------------------------------------|-------------|
| #1 pain: slow / after-hours replies | Agent seam (§B) + messaging outbox (§F); the LLM agent (separate service) is what actually answers. |
| "Cancellation must need approval" | Enforced by the HITL model — cancellation is an escalation, never an agent action (§A). |
| WhatsApp "essential" | Messaging outbox interface now (§F); real BSP adapter flagged (§5). |
| Hosts foreign guests | Foreigner C-Form capture (§C). |
| Was a scam victim; fake-payment scam | Scam-number list + verification checklist (§D). |
| Advance payment "always" | Advance-payment tracking (§E). |
| Staff see bookings, not money | **Roles → deferred with multi-tenancy.** Note the requirement; don't build now. |
| Overflow referrals / "Rapido for homestays" / shared scam list / shared availability | **Community network → deferred** (cross-tenant). Single-property scam list only. |
| Plain-language reporting (Console 4.3) | Agent reads analytics/finance via §B; the console UI is the separate agent service. Not built here. |
| Planning to list on OTAs | Existing iCal + Inbox groundwork already covers it; nothing new now. |

---

## 4. The work — phase specs

Each phase is one or more branches/PRs. Acceptance criteria are the bar for
"done." Follow the existing "add an admin-managed entity" recipe in
`docs/CONTRIBUTING.md` for any new CRUD entity.

### Phase A — Integrate the escalation module

The module is already authored in `escalation-module/` (model, lib, 3 routes,
server page, client component) with a wiring guide. Your job is integration, not
authorship.

- Append `escalation-module/prisma-escalation.prisma` to `prisma/schema.prisma`;
  create the migration with `npm run db:migrate:new add_escalations` then
  `--apply`. (It's additive — new enums + one table; touches nothing in the
  correctness core.)
- Copy the `src/**` files to their matching paths.
- **Middleware:** add `/api/agent` to the matcher's exclude list (next to
  `/api/ingest`) so the token-gated agent seam is reachable without the owner
  cookie.
- **Env:** add `AGENT_TOKEN` to `.env.example` (placeholder) and document it in
  `docs/SETUP.md` + `docs/DEPLOYMENT.md`. The route fails closed if unset.
- **Nav:** register `/escalations` in `NavShell.tsx` (secondary group, beside
  Inbox/Feeds); add an open-count badge using the cached-badge pattern in
  `layout.tsx`.
- Verify against `escalation-module/INTEGRATION.md`. Confirm the UI uses only
  existing design-system classes; if `--clay-*` tokens are absent in
  `globals.css`, the high-severity pill already falls back to `--warn-*`.

**Acceptance:** lint/tsc/test green; `POST /api/agent/escalations` with
`AGENT_TOKEN` creates a ticket (and de-dupes on repeated `externalId`); the
`/escalations` queue lists it, an owner can claim/resolve/dismiss, and the KPI
strip (open / in-progress / avg response / critical) computes. Add a route-level
test for the agent-token gate (401 without, 201 with).

### Phase B — Agent API seam (`/api/agent/*`, token-gated)

The clean contract the separate ROOT bot calls. **Token-gated by `AGENT_TOKEN`,
excluded from the owner cookie** (same as `/api/ingest`). Reuse the existing
domain logic — do not duplicate it.

Endpoints (all carry `x-agent-token` / `Authorization: Bearer`):

- `GET /api/agent/availability?roomTypeId&checkIn&checkOut` → wraps
  `src/lib/availability.ts`. Read-only.
- `GET /api/agent/quote?roomId&checkIn&checkOut` → wraps `pricing.quoteRoomType`.
  Advisory rate, as the owner UI gets.
- `POST /api/agent/reservations` → **calls the same reservation-create domain
  function the owner route uses**, so it inherits the GiST 409. Upserts the
  guest, records `source` (e.g. an "Assistant" channel), returns the reservation.
  This is for **simple, OTP-verified bookings only**; anything non-trivial the
  bot must file as an escalation instead.
- (Escalation filing already exists at `POST /api/agent/escalations`.)

Each accepts an optional `propertyRef` (ignored today; forward-compatible).

**Decision to surface in your plan (don't guess):** should the agent's booking
be *created confirmed* (direct, conflict-checked) or *staged for owner review*
like `InboundBooking`? Default recommendation: **created confirmed through the
guarded path for simple verified bookings; everything else escalates.** Confirm
with the maintainer.

**Acceptance:** the three endpoints work with the token and 401 without;
`POST /api/agent/reservations` returns 409 on an overlapping stay (add a test);
no new code path can create a reservation without going through the shared
create logic.

### Phase C — Foreigner registration (C-Form) capture

Additive fields on `Guest` (and surfaced at check-in): `nationality`,
`passportNumber`, `passportExpiry`, `visaNumber`, `arrivedFrom`, `nextDestination`,
`dateOfArrivalInIndia`. A flag like `isForeignNational` shows the section.

- Migration: additive nullable columns via `db:migrate:new`.
- UI: a collapsible "Foreign national details (C-Form)" section on the
  guest/check-in form; a printable record (reuse the invoice print-CSS pattern).
- Keep it data-capture + print for now; **do not** build live FRRO/C-Form portal
  submission (out of scope — flag if asked).

**Acceptance:** fields persist, show at check-in for flagged guests, and print
cleanly; existing guest flows unaffected.

### Phase D — Scam-number list + payment-verification checklist

Single-property now (the shared/community version is deferred).

- New `FlaggedNumber` entity (`phone` unique, `reason`, `reportedAt`, nullable
  `property_id` for forward-compat). CRUD per the standard recipe.
- At advance-payment entry: if the payer's number matches a flagged number, show
  a loud warning; always show a short **"verify the payment with your bank
  before confirming"** checklist (the fake-payment scam is exactly an unverified
  "overpaid, refund me the difference" message).
- A small admin screen/section to view and manage flagged numbers.

**Acceptance:** flagging a number warns on matching payment entry; the verify
checklist appears at advance entry; nothing auto-blocks (human decides).

### Phase E — Advance-payment request tracking

Mostly surfacing existing payment data: on a reservation, show expected advance
vs received, and a clear pending/paid state; a "record advance" action ties into
Phase D's verification. No new payment rails.

**Acceptance:** a reservation clearly shows advance expected/received/pending;
ties to the verification checklist.

### Phase F — Messaging outbox abstraction

A seam so the system *can* notify guests (confirmation, reminder, payment
request) without committing to a provider yet.

- `src/lib/messaging.ts`: a `Notification` type + a `send(channel, to, template,
  data)` interface with a **`LogAdapter`** (writes to a `Notification` table /
  console) as the default. Real WhatsApp/SMS adapters are later (need a BSP — §5)
  and must be flagged before adding any SDK.
- Optionally a `Notification` table to record what would be / was sent (audit).
- Wire one or two natural triggers (e.g. booking confirmation) behind the
  log adapter so the seam is exercised end-to-end.

**Acceptance:** creating a booking records an outbound "confirmation"
notification via the log adapter; swapping in a real adapter later requires no
caller changes; no messaging SDK added without a flag.

---

## 5. Decisions already made (don't re-open)

- **Single-tenant for this work.** Multi-tenancy is a separate, later effort.
- **The LLM agent is a separate service.** This repo exposes the API it consumes.
- **Naming is ROOT** (not ROOTS) — keep consistent in any new copy/docs.
- **WhatsApp needs a BSP** (Business API provider) with approval + per-message
  cost and real lead time. The messaging interface is built now; the real adapter
  and provider choice are a flagged follow-up, not part of this work.
- **Demo-first.** The target is a credible single-property demo for the
  PrimeMeghalaya pitch (see `ROOT_Demo_RunOfShow.html`): the backbone is real,
  the escalation/HITL is real, the agent seam is real; the conversational agent
  is the existing prototype calling these APIs; the community network is shown as
  designs, labelled honestly.

---

## 6. Definition of done & demo-readiness

The whole effort is done when:

- All of §3-in-scope phases are merged, lint/tsc/test green, migrations applied
  via the safe helper, and the GiST constraint verified intact (the helper does
  this).
- A short `docs/ROOT-INTEGRATION-STATUS.md` records what shipped, what's stubbed
  (the messaging log adapter, the forward-compat `property_id`/`propertyRef`),
  and what's deferred (multi-tenancy, roles, community network, real WhatsApp).
- The demo path works locally end to end: an agent token call files an escalation
  → it appears in `/escalations` → owner resolves; a `POST /api/agent/reservations`
  is conflict-checked; the C-Form section captures + prints; a flagged number
  warns at payment entry.

---

## 7. Open questions to put in your plan (ask; don't guess)

1. Agent bookings: **created confirmed** (recommended for simple verified cases)
   or **staged for review** like `InboundBooking`?
2. Is single-tenant acceptable for this entire effort (recommended **yes**), with
   multi-tenancy as a separate later piece?
3. Which messaging triggers to wire behind the log adapter first
   (confirmation only, or also reminder + payment request)?
4. Should the agent seam live under `/api/agent/*` (recommended, mirrors
   `/api/ingest`) — confirm the middleware exclusion is acceptable?
5. Any C-Form fields specific to Meghalaya/FRRO practice to add or drop?
