# Roadmap & Project Status

> 📄 For a consolidated, shareable view of everything below **plus a step-by-step
> guide to enabling the not-yet-wired features**, open
> [docs/STATUS.html](STATUS.html) in a browser.

## Where we are

The app shipped its planned scope across six milestones — all in production on
`main`. The original product brief and rationale live in [CLAUDE.md](../CLAUDE.md).

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

### Phase 6 — Invoices + export
Printable guest invoices (browser Print → PDF, using the property profile) and
dependency-free **Bookings / Payments CSV** exports for the accountant.

## Deferred — by design

These were intentionally left out (see [CLAUDE.md](../CLAUDE.md) "do NOT" rules and
phase scoping). They are **not** bugs:

| Deferred | Why / what it would need | Status |
|----------|--------------------------|--------|
| **OTA email ingestion** | Parse the owner's confirmation emails into bookings. | 🟡 **Groundwork built** — parser, staging model, **Inbox** paste/review/create flow, and a token-gated webhook seam (`POST /api/ingest/email`) all exist. Usable today via paste. Only the inbox/forwarding plumbing remains, plus tuning the parser against real OTA emails. |
| **Messaging automation** | WhatsApp/email/SMS templates + triggers. Needs a messaging provider. | ○ Deferred |
| **Dynamic pricing → OTAs** | Not possible for a single property — no OTA connectivity API. Pricing stays advisory/internal. | ○ Won't do (external limit) |
| **Multi-role auth + prod hardening** | Currently single-owner; would need accounts, roles, lockout. | 🟡 **Login rate-limiting done** (`src/lib/rate-limit.ts`); roles still deferred |
| **Guest ID document/photo upload** | Needs object storage. | 🟡 **Groundwork built** — Supabase Storage adapter, upload/view/delete endpoints, and guest-profile UI. Activate by creating a private bucket + setting the storage env vars (see [SETUP.md](SETUP.md#optional-integrations-leave-unset-to-keep-them-off)). |
| **Server-side PDF invoices** | Would need a PDF library. Today uses the browser's Print → Save as PDF. | ○ Deferred |

## Known concerns / tech debt

Tracked with file/line references in
[`.planning/codebase/CONCERNS.md`](../.planning/codebase/CONCERNS.md). Highlights
worth a new team's attention:

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
3. Skim [`.planning/codebase/CONCERNS.md`](../.planning/codebase/CONCERNS.md).
4. Good first improvements: route-level tests for the booking/overlap path; a
   housekeeping-derivation test; rotate the single iCal token to per-feed tokens if
   feed privacy matters.
