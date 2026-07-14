# Roadmap & Project Status

## Where we are

The app shipped its original scope across six product milestones, then a large
**gap-analysis programme** (against MindBit's ROOT/Lawei review) added three more
phases — **all in production on `main`**. The original product brief lives in
[CLAUDE.md](../CLAUDE.md). The three gap-analysis phases were: **Phase 1** (close
the core), **Phase 2** (complete the PMS & team — multi-tenancy, RBAC, staff/ops
modules), and **Phase 3** (the regional community network). All shipped; what
follows is the living record of what's built and what's deferred.

Two cross-cutting passes followed the feature work:

- **UI/UX redesign** (shipped 2026-06-05) — a warmer navy/teal/mint design system
  (Fraunces / Plus Jakarta Sans / JetBrains Mono), a mobile bottom tab bar + FAB
  and desktop sidebar, calendar Day/Week/2-Week/Month views, in-app confirm
  dialogs, and a Preferences panel (appearance / accent / density). See
  [ARCHITECTURE.md → UI](ARCHITECTURE.md#ui--design-system).
- **Performance** — pooled DB connections + region co-location + instant
  navigation feedback. See [ARCHITECTURE.md → Performance](ARCHITECTURE.md#performance-serverless--remote-db).

## Delivered

### Phase 1 — Operations core + Admin
Bookings (create/edit/cancel) with DB-enforced no-double-booking; unified
calendar (rooms × dates, colour-coded, week/2-week/month views); Today dashboard;
guests list/search; housekeeping (derived "needs cleaning" + manual flag);
single-owner login; PWA. Plus **Admin/Settings**: add/edit/**archive** rooms,
manage room types, channels + commissions, the property profile, and **maintenance
blocks** (hold a room out of service with a comment).

### Phase 2 — Pricing (advisory)
Rule-based nightly rate engine — weekend, season/holiday, lead-time (early-bird /
last-minute), and occupancy adjustments, compounded then clamped to each room
type's floor/ceiling. A **rate calendar** with tap-to-pin manual overrides, and a
suggested price that pre-fills new bookings. Advisory only: never pushed to OTAs,
never rewrites saved bookings.

### Phase 3 — Check-in / check-out
`checkedInAt` / `checkedOutAt` on bookings with check-in/out/undo actions, surfaced
on the reservation detail and the Today board.

### Phase 4 — Guest CRM
Guest profiles with stay history, repeat-guest badge, lifetime value, ID (text),
notes, and a blacklist toggle that warns at booking time.

### Phase 5 — Finance → real profit
Per-channel revenue and commission, plus **expense tracking** so Finance shows true
**net profit** (gross − commission − expenses).

### Phase 6 — Analytics, invoices + export
An **Analytics dashboard** — occupancy, ADR, RevPAR, average stay, cancellation
rate — with **interactive charts** (occupancy trend, source-mix donut, a
**revenue-by-channel** bar chart) via Recharts, plus a **Download CSV** of the whole
Analytics view (`GET /api/analytics/export`). Printable guest invoices (browser
Print → PDF) and dependency-free **Bookings / Payments CSV** exports for the accountant.

### ROOT agent integration (phases A–F)
The deterministic core's half of the contract with the ROOT AI agents — built as a
small, token-gated seam (`AGENT_TOKEN`, fail-closed) so agents reach the app
without ever getting direct write access to money or bookings. See
[INTEGRATION.md](INTEGRATION.md) and [ARCHITECTURE.md → ROOT agent seam](ARCHITECTURE.md#root-agent-seam).

- **A — Escalations.** A human-in-the-loop queue (`/escalations`, nav badge) agents
  file into; sensitive actions are escalated for a human to commit, never taken.
- **B — Agent seam.** `GET /api/agent/availability` · `GET /api/agent/quote` ·
  `POST /api/agent/reservations` — bookings run the same GiST-guarded transaction as
  the owner path (409 on overlap).
- **C — C-Form.** 13 nullable foreign-national registration fields on the guest
  profile (passport / visa / port + date of entry / purpose).
- **D — Scam-number list + payment verification.** A flagged-numbers list that warns
  at booking time (Settings → Scam numbers) and a UPI/bank verification checklist on
  the payments panel.
- **E — Advance-payment tracking.** `advanceRequired` on a booking + `isAdvance` on a
  payment; advance status is derived, never stored.
- **F — Messaging outbox.** A LogAdapter (`src/lib/messaging.ts`) + `/messages`
  outbox; agents queue messages via `POST /api/agent/messages` (`status=logged`
  until a provider is wired). This is the groundwork the deferred messaging
  automation will plug a provider into.

### Agent AI architecture upgrade (`assistant-agent`, its own A–F plan)
The Python assistant sidecar (Google ADK + Gemini, on Cloud Run) got a full
reliability/quality pass — shipped as PRs #136–#145, distinct from the seam
lettering above. See `assistant-agent/README.md` and the architecture-upgrade plan.

- **Resilience** — 3-attempt run chain with a `GEMINI_FALLBACK_MODEL` fallback; no
  more silent empty replies.
- **Two isolated personas** — guest vs owner, with a startup assertion that owner-only
  tools can never leak into the guest agent.
- **Shared prompts + canonical security block** composed per turn (security outranks
  everything, including owner policies).
- **Runtime owner policies** — owners edit assistant behaviour from Settings →
  "Assistant rules" (`GET /api/agent/policies`), applied within ~1 min, no redeploy.
- **Per-turn diagnostics** (tools, tokens, fallback) in the chat log; **FAQ media**
  cards; and a **pytest suite + `agent-tests` CI job**.

## Bookings list
A searchable all-bookings view at `/reservations` (labelled **Bookings** in nav)
— instant client-side search by guest, phone, room or channel, plus timeline
filter chips (Upcoming · In-house · Past · Cancelled, no-show folded into
Cancelled) — added alongside the calendar and Today board.

## Delivered — Lawei gap-analysis (Phases 1–3)

Built after the original milestones, plan-first, one PR per slice, CI-gated.
Full detail in the status notes; in brief:

- **Gap Phase 1 — close the core.** Structured guest fields (address, vehicle,
  preferences) + ID-verification flags; configurable cancellation policy + refund
  workflow; complaints module; UPI/pay-link + pending-payments card; CSV import;
  booking-confirmation trigger.
- **Gap Phase 2 — complete the PMS & team.** **Multi-tenancy** (auto-scoping
  Prisma extension) + **real auth & RBAC** (owner/reception/housekeeping, "money
  only for owners"); staff directory/roster/attendance; housekeeping assignment +
  checklist; maintenance + assets; inventory; vendors + procurement; transport
  records (dispatch stays in ROOT); group/long-stay bookings; amenities; reviews
  tracker; audit log + guest consent. Deploys now run `prisma migrate deploy`.
- **Gap Phase 3 — regional community network.** Trusted-network connections +
  per-peer sharing grants; searchable property directory; shared (derived)
  availability; **overflow referral marketplace** with a derived reciprocal-credit
  ledger; opt-in verified scam + bad-guest networks (hashed signals, evidence,
  moderation, appeal, retention); no-show reliability score → shared flag; shared
  vendor/driver directories; multi-location property switcher + offline tolerance.

The community network is inherently cross-tenant: all peer access goes through a
single audited, grant-gated seam that never exposes guest PII, occupancy, or
finance. See [ARCHITECTURE.md → Multi-tenancy](ARCHITECTURE.md#multi-tenancy--the-community-seam).

## Deferred — by design

These were intentionally left out (see [CLAUDE.md](../CLAUDE.md) "do NOT" rules and
phase scoping). They are **not** bugs:

| Deferred | Why / what it would need | Status |
|----------|--------------------------|--------|
| **OTA email ingestion** | Parse the owner's confirmation emails into bookings. | 🟡 **Groundwork built** — parser, staging model, **Inbox** paste/review/create flow, and a token-gated webhook seam (`POST /api/ingest/email`) all exist. Usable today via paste. Two **ready-to-deploy forwarders** now ship in [`integrations/`](../integrations/) (Gmail Apps Script — no domain; Cloudflare Worker — optional, for a branded domain instead of a personal Gmail); only setting the token + tuning the parser against real OTA emails remains. |
| **Messaging automation** | WhatsApp/email/SMS templates + triggers. Needs a messaging provider. | 🟡 **Groundwork built** — a LogAdapter outbox (`src/lib/messaging.ts`), `/messages` review screen, and the agent `POST /api/agent/messages` seam all exist and log every message. Wiring a provider (and flipping `status` to sent/failed) is all that remains; callers don't change. |
| **Dynamic pricing → OTAs** | Not possible for a single property — no OTA connectivity API. Pricing stays advisory/internal. | ○ Won't do (external limit) |
| **Multi-role auth** | Accounts, roles, lockout. | ✅ **Done** (gap Phase 2) — `User` table, scrypt, owner/reception/housekeeping RBAC, login rate-limiting (`src/lib/rate-limit.ts`) |
| **Guest ID document/photo upload** | Needs object storage. | 🟡 **Groundwork built** — Supabase Storage adapter, upload/view/delete endpoints, and guest-profile UI. Activate by creating a private bucket + setting the storage env vars (see [SETUP.md](SETUP.md#optional-integrations-leave-unset-to-keep-them-off)). |
| **Server-side PDF invoices** | Would need a PDF library. Today uses the browser's Print → Save as PDF. | ○ Deferred |

## Known concerns / tech debt

This is the canonical list — what a new team should know:

- **Migration discipline** is load-bearing: the generated `DATERANGE` columns +
  GiST constraint require the safe `db:migrate:new` helper. Most fragile area of
  the repo. (See [CONTRIBUTING](CONTRIBUTING.md#database-migrations-read-this-first).)
- **Overlap-error detection** sniffs the Postgres error string (`23P01` / constraint
  name) in [`src/lib/db-errors.ts`](../src/lib/db-errors.ts) — keep `tests/conflict.test.ts`
  green if you touch it.
- **Money is whole-rupee `number` math** — fine today; would need integer-paise or
  decimal arithmetic for strict accounting.
- **Test breadth**: the correctness core (conflicts, availability) and pure pricing
  are tested; route handlers and the `quoteRoomType` data wrapper are not. The
  highest-value gap to close is a route-level create-overlap → 409 test.
- **Pricing rate-calendar** re-fetches global config per room type (mild N+1, fine
  at small scale).

## Suggested next steps for a new team

1. Read [ARCHITECTURE.md](ARCHITECTURE.md) (correctness core) and
   [CONTRIBUTING.md](CONTRIBUTING.md) (migration safety) first.
2. Get a local env up ([SETUP.md](SETUP.md)) and run `npm test` to confirm the DB
   wiring.
3. Skim **Known concerns / tech debt** above.
4. Good first improvements: route-level tests for the booking/overlap path; a
   housekeeping-derivation test; rotate the single iCal token to per-feed tokens if
   feed privacy matters.
