# Module-by-Module Analysis
## Guest House Operations Hub — Discovery doc 03 · v1.0 · 2026-07-16

Depth is calibrated: **Tier A** (correctness-/money-/legal-critical) modules get the full template (purpose, actors, journey, requirements, rules, validations, edge cases, risks, dependencies, APIs, DB, permissions). **Tier B** modules get a compact template. FR/BR/GAP/Q IDs cross-reference docs 02/05/06/09.

Legend: `[F]` fact from sources · `[I]` inferred · `[R]` recommendation · `[Q]` open question.

---

# TIER A MODULES

## A1. Booking Engine

**Purpose.** Create and manage reservations — the system's central transaction — with double-booking impossible at the database level.
**Actors.** Reception, Owner, AI agent (via seam), Inbox review flow, CSV import.
**Permissions.** Owner + Reception create/edit/cancel; Housekeeping none; Agent creates only via token seam.

**User journey (happy path).** New → guest name+phone (existing guest auto-matched by phone) → channel → optional travel agent → room → dates (+arrival time) → amount (pricing suggestion pre-fills; "Use" or type) → special requests → ID-confirmation tick → Save → confirmed; confirmation message auto-drafted to outbox.

**Inputs.** guestName, phone, email?, channelId, agentId?, roomId, checkIn, checkOut, arrivalTime?, grossAmount, specialRequests?, idConfirmed, advanceRequired?
**Outputs.** Reservation(confirmed), Guest (created or reused), OutboundMessage(draft confirmation), calendar/Today updates.
**Preconditions.** Authenticated non-housekeeping user in acting property; room active (not archived).
**Postconditions.** `stay = [checkIn, checkOut)` DATERANGE persisted; no overlapping confirmed stay exists for the room (DB-guaranteed); availability derivations updated implicitly.

**Validations.**
- checkOut > checkIn (half-open; 1-night minimum). `[Q]` max stay length? past-dated bookings allowed (for import/records)? — Q-OPS-01.
- Phone format normalization (critical: dedupe + scam-list + community hashing all key on phone `[R]` — E.164 canonicalization required; unverified `[I]`).
- Amount ≥ 0; within sanity bounds `[R]`; whole-rupee today (GAP-9).
- If property setting "ID number required to book" — enforce `[F]`.
- Warnings (non-blocking): blacklist hit, scam-number hit `[F]`.

**Business rules.** BR-BOOK-01…09 (doc 05). Key: overlap→friendly 409; cancelled/no_show stays don't block dates; blacklist warns-not-blocks; agent commission attribution at booking time.

**Exceptions / error conditions.**
- GiST violation → "those dates are no longer available for this room" (23P01 sniffed in `db-errors.ts` — fragile string-matching, keep tests green `[F]`).
- Race: two receptionists booking the same room simultaneously → one wins, one gets 409 — correct by design `[F]`.
- Guest phone matches two properties' history: guests are owner-wide, fine `[F]`; matches *another client*: invisible (separate DBs) `[F]`.

**Alternate flows.** Edit (dates changed → same constraint path); cancel (→ Cancellation module); agent-seam create (same transaction, 409 on overlap `[F]`); CSV import row (same checks `[F]`); group booking (each room normal, then attached to folio `[F]`).

**Edge cases requiring decisions.**
1. Same-day checkout+checkin turnover on one room — half-open ranges make this legal `[F]`; housekeeping "clean first" flag covers ops `[F]`.
2. Booking spanning a rate-season boundary: amount is a single figure; no per-night rate breakdown stored — limits invoice detail & analytics precision `[R]` GAP-22.
3. Room archived while holding future bookings — allowed? `[Q]` Q-OPS-02.
4. Guest books 2 rooms same dates (family) — two reservations + optional group folio `[F]`; UX cost of re-entering guest `[I]`.
5. Overbooking *by room type* intentionally (sell N+1 expecting cancellation) — impossible by design (room-level assignment at creation). This is a **deliberate product stance**: no unassigned/room-type-level bookings. Confirm the stance is acceptable for peak season `[Q]` Q-OPS-05 — many small hotels want type-level booking with room assignment at check-in. **High-impact design question.**
6. Modification arriving from OTA (date change) — no linked-update path (GAP-2).

**Risks.** Money math (GAP-9); error-string sniffing breaks on Postgres/Prisma upgrade; no route-level 409 test (repo-acknowledged).
**Dependencies.** Availability engine, Pricing suggestion, Guest dedupe, Channels, Agents, Messaging outbox, audit log.
**APIs.** CRUD reservation routes; `POST /api/agent/reservations`; availability query. (Exact route audit — iteration 2.)
**DB.** `Reservation` (stay DATERANGE, status enum, checkedInAt/OutAt, otaRef, agentId, advanceRequired, groupId…), GiST exclusion `WHERE status='confirmed'`.

---

## A2. Availability Engine

**Purpose.** Derive free units per room type/date from reservations + blocks; the correctness core.
**Rules.** available(type, date) = units(type) − confirmed reservations overlapping date − blocks overlapping date `[F]`. Never stored `[F]` (C-03).
**Actors.** Every booking surface; agent seam (`GET /api/agent/availability`); community shared-availability (derived) `[F]`.
**Edge cases.** Archived rooms excluded from units but history retained `[F]`; blocks from iCal import count as busy `[F]`; cancelled frees instantly `[F]` — but **iCal export consumers see it only on their next pull** → transient phantom-busy on OTAs `[I]`; DST-free zone (IST) simplifies dates, but server TZ vs property TZ must be pinned `[Q]` Q-TEC-05.
**Risks.** Raw SQL in `freeRooms` must hand-scope `property_id` `[F — repo-acknowledged]`; any new raw query is a cross-property leak risk (within one owner). `[R]` CI grep-guard.
**Missing.** Oversell buffer feature (FR-AVAIL-5, GAP-24); availability by *type* for agents when multiple units (agent quoting picks a room how? `[Q]` Q-AI-02).

---

## A3. Calendar & Conflicts

**Purpose.** Visual command centre (rooms × dates); surface conflicts needing human decision.
**Journey.** Swipe/page dates; tap stay → detail; tap empty night → prefilled new booking; views Day/Week/2-Week/Month `[F]`.
**Conflict semantics.** Two confirmed bookings can never overlap (prevented) `[F]`; conflicts = booking × block overlaps (e.g. iCal block lands on an existing stay, or manual block over a stay) → red + Conflicts screen; resolve by editing either side `[F]`.
**Edge cases.** iCal import creating a block over an existing direct booking is the *expected* cross-channel double-book detection path `[I]` — make this explicit in ops training `[R]`. Offline-created booking that clashed syncs → "the app tells you" `[F]` — surface & flow unverified `[Q]` Q-TEC-04.
**Missing.** Drag-to-move/resize stays `[R nice-to-have]`; room-change mid-stay (split stay) — no evidence of support `[Q]` Q-OPS-07 — common hotel need.

---

## A4. Payments, Refunds, Deposits (money core)

**Purpose.** Record and verify money in; compute refunds on cancellation; keep balance truthful.
**Actors.** Owner, Reception (record `[F — "record payments" is day-to-day]`; visibility of totals for reception `[Q]` — money is owner-only per RBAC, yet reception records payments: exact boundary needs definition — Q-FIN-05 **[contradiction candidate]**).

**Journey (collect).** Booking → payments panel (collected, balance due) → Add payment (amount, mode) → if UPI/bank: verification checklist (sender name, funds landed, UTR) must all be ticked before save `[F]` → advance flag if applicable → balance recomputes.
**Journey (refund).** Cancel booking → ladder computes suggested refund → owner approves same or different amount → Refund recorded (status) → payout executed outside the system `[I]`.

**Validations.** amount > 0; amount ≤ outstanding? `[Q]` — overpayment/credit handling undefined Q-FIN-06; UTR format check `[R]`; mode ∈ {cash, UPI, card, bank, OTA-collect}.
**Business rules.** BR-PAY-01…08 (doc 05): advance status derived never stored `[F]`; OTA-collect implies money arrives via OTA payout not guest `[I]` — reconciliation gap GAP-13.
**Exceptions.** Fake-payment scam attempt → checklist blocks `[F]`; gateway webhook replay → idempotency (planned Razorpay) `[F]`.
**Edge cases.** Partial refund after partial payment (refund > paid?); refund of OTA-collect booking (OTA refunds guest; hub must not double-count) `[Q]` Q-FIN-07; currency setting ≠ INR with UPI links `[I contradiction]` Q-FIN-08; payment recorded on cancelled booking.
**Risks.** Whole-rupee float math (GAP-9 — Must-fix before accounting claims); no payment immutability/void-with-audit (Q-FIN-04); reception/owner money boundary (above).
**DB.** `Payment` (mode enum, isAdvance), `Refund` (status enum), `CancellationPolicy` tiers.

---

## A5. Invoicing & Finance

**Purpose.** Give the guest a bill; give the owner truth (net = gross − commission − expenses) and accountant-ready exports.
**Delivered.** Invoice (browser print) with property identity + GST number; finance tiles, by-channel, expenses, balances due, CSVs `[F]`.
**Hidden complexity `[R]`.**
- *GST correctness*: hotel tariffs attract slab-dependent GST; invoice today shows a GST *number* but no evidence of tax lines/rates. If any pilot is GST-registered this is a legal must (GAP-11, Q-FIN-02).
- *Invoice numbering*: sequential, gap-free series per financial year is a statutory expectation; browser-print with no stored invoice record breaks this `[I]` — recommend an `Invoice` entity with immutable number/snapshot `[R]`.
- *Commission basis*: Booking.com commission-on-gross vs MMT net-rate models differ; single `commission_pct` per channel may misstate net (Q-FIN-01).
- *Agent + channel commission stacking* on one booking — both can apply `[I]`; confirm intended arithmetic (Q-FIN-01).
- *Accrual vs cash*: tiles mix confirmed revenue and received payments; date-range semantics (by stay date? booking date? payment date?) undefined `[Q]` Q-FIN-09 — analytics can silently mislead.
**Missing.** OTA payout reconciliation (GAP-13); Tally/accounting export (future); expense categories/receipts `[Q]` Q-FIN-10.

---

## A6. OTA Email Ingestion (Inbox)

**Purpose.** Get OTA bookings into the calendar without APIs, with a human always confirming.
**Journey.** Confirmation email arrives → (manual paste **or** forwarder → webhook) → parser stages `InboundBooking` (pending review) with guest/dates/amount best-effort → operator corrects, picks room → Create (conflict-checked) or Dismiss; original viewable `[F]`.
**Validations.** Parsed dates sane; amount numeric; duplicate `ota_ref` suppression `[I — verify]`; token check on webhook.
**Failure paths.** Unparseable → staged raw with reason (FR-ING-4) `[R — confirm behaviour]`; forwarder down → emails simply don't arrive (silent!) `[R]` add heartbeat GAP-5; OTA format change → parse quality degrades silently `[R]` add parse-confidence metric.
**Edge cases / missing.** Modification & cancellation emails (GAP-2 — today they'd stage as a *new* pending item at best, or parse wrongly; a modification not applied = ghost availability or oversell); multi-room OTA bookings in one email; virtual-card payment details in Booking.com emails (PCI-sensitive — do not store `[R]`); non-English emails.
**Risks.** RSK-B6 (format drift); Gmail Apps Script quotas `[I]`.
**Dependencies.** Booking engine, forwarders (`integrations/`), token config.

---

## A7. iCal Import / Export & Cross-Channel Sync

**Purpose.** Minimise (not eliminate) the cross-channel double-booking window using free feeds.
**Semantics `[F]`.** Import: OTA busy dates → blocks per room; daily auto + manual Sync now. Export: private per-room `.ics` of busy dates. iCal is not real-time (hours lag), binary busy/free per single unit, availability-only (no rates/guests), and not offered for all listing types.
**Edge cases.**
- Multi-unit room types: an OTA listing "3 Deluxe" cannot be expressed — iCal is per *room*; mapping OTA listing↔hub room must be 1:1 or oversell risk persists `[F/I]` — onboarding rule `[R]`.
- Event removed at OTA (their cancellation) → must release block (Q-TEC-06); stale blocks = lost revenue.
- Import overlapping an existing confirmed stay → conflict flag (by design) — who wins, and what does the owner *do*? Needs playbook `[R]`.
- Export URL leak = availability disclosure; single shared token (repo suggests per-feed rotation) `[F]`.
- Feed URL rot / OTA disables iCal → silent staleness (GAP-5: last-success timestamp + alert `[R]`).
**Risks.** Residual oversell window is *honest and documented* `[F]` — mitigation ladder: buffer feature (GAP-24) → more frequent sync (GAP-6) → paired channel manager (future scope).

---

## A8. Check-in / Check-out, ID Verification, Form C

**Purpose.** Legal-grade arrival processing; housekeeping trigger on departure.
**Journey.** Arrival → booking → gate: ID recorded (number, scan, or verified tick; C-Form fields for foreign guests) per property strictness block/warn/off → Check in (timestamp) → … → Check out → room joins To-clean `[F]`. Undo steps back one stage `[F]`.
**Validations.** Gate logic per settings `[F]`; foreign guest detection — how? nationality field? `[Q]` Q-OPS-10 (a foreigner mis-filed as domestic silently skips C-Form — validation needed `[R]`).
**Form C reality check `[R]`.** Indian rules require reporting foreign guests (Form C via FRRO portal) typically within 24h of arrival. The hub captures the 13 fields but produces **no artefact and no submission support** (GAP-7). Minimum viable: printable/exportable pre-filled Form C + a "submitted" checkbox + due-within-24h reminder. Actual FRRO e-submission is out of scope (no public API `[I]`), Q-LEG-02.
**Edge cases.** Early check-in/late check-out fees — no fee construct `[Q]` Q-OPS-11; check-out with balance due allowed? (Q-OPS-03); group check-in (one ID per guest or per booking? registry expectations `[Q]` Q-LEG-04); walk-in with no booking — must create booking first `[F implied]`.
**Data protection.** ID scans = sensitive PII: retention default indefinite until configured (repo-acknowledged — change default `[R]`); access logging on views/downloads ✖ (GAP-15).

---

## A9. Pricing Engine (advisory)

**Delivered `[F]`.** Rules: weekend (days+uplift), seasons/holidays date-ranges with adjustment, early-bird/last-minute by lead time, busy-period/occupancy; compounded, clamped to floor/ceiling; rate calendar; pinned overrides; pre-fill on booking; never external, never rewrites bookings.
**Dissection.**
- Compounding order & interaction (e.g. weekend × season × last-minute stacking to ceiling constantly?) undocumented — Q-OPS-08; publish the formula in Help `[R]`.
- Override scope = room type × date `[F]`; per-*room* premium (view/balcony) impossible — acceptable? `[Q]`.
- Occupancy input to busy-pricing: which occupancy (that date's forecast)? `[I]` verify.
- No competitor/OTA-parity awareness — advisory-only is honest, but suggestion drift vs OTA published rates confuses guests quoting both `[R]` note in training.
**Risks.** Low — advisory design contains blast radius `[R — good design]`.

---

## A10. AI Agent Seam & Escalations (HITL)

**Delivered `[F]`.** Token-gated fail-closed seam: availability / quote / create-reservation (same GiST transaction) / queue-message / file-escalation; escalation queue with source/category/severity, guest message + summary, open→in-progress→resolved; owner-editable runtime policies (~1 min apply); sidecar: persona isolation (guest vs owner, startup assertion), canonical security block outranking owner policies, model fallback chain, per-turn diagnostics, FAQ media, pytest+CI.
**Dissection.**
- **Escalation latency**: queue+badge only; an owner asleep = guest waiting hours. Push/WhatsApp notify on high-severity ✖ (GAP-14, Must for BO-06).
- Agent-created bookings: which guest identity checks apply (scam list? blacklist?) at seam level `[Q]` Q-AI-03; amount = quote from pricing engine `[I]`.
- Quote→book race: no hold; guest confirms, room gone → 409 → agent must handle gracefully (verify UX `[Q]` Q-AI-02).
- Prompt-injection: canonical security block exists `[F]`; red-team evidence `[Q]` Q-AI-05.
- Guest PII → Gemini (US processing): consent/notice ✖ (NFR-PRV-04).
- Seam versioning/contract tests between hub and sidecar `[R]`.
**Permissions.** Escalation resolution: owner+reception `[I]`; linked sensitive action (cancel/refund) through normal RBAC-guarded screens `[F — good]`.

---

## A11. Community Network (referrals, shared lists)

**Delivered `[F]`.** Connect codes; per-peer grants (rooms/referrals/scam/bad-guest/vendors/drivers); directory by amenities; referrals: full property refers guest → peer accepts → books via normal conflict-checked path → revenue attributed → derived reciprocal-credit ledger; verified scam/bad-guest sharing: evidence required, dispute/appeal, auto-expiry, hashed phone matching, opt-in, no PII/occupancy/finance ever; single audited grant-gated seam.
**Dissection — the package's most legally exposed module `[R]`.**
1. **Topology**: clients are fully isolated deployments — where do shared reports and referrals physically live? A MindBit-operated registry service? Peer-to-peer? Undefined in available docs — Q-LEG-03/Q-TEC-07. This decides data-controller responsibilities.
2. **Defamation/DPDP**: a "bad guest" alert is an adverse profile of an identifiable person. Evidence+appeal+expiry are the right primitives `[R — good]`, but need: written moderation policy, who adjudicates disputes across independent owners, notice to the flagged person? (likely impractical — legal review required), and hashing that resists enumeration (phones are 10-digit; salt/pepper per-network `[R]`, NFR-SEC-09).
3. **Referral credit ledger**: derived, never stored `[F — good]`; but settlement (cash? reciprocity only?), dispute, and what happens on peer disconnect — undefined (Q-BUS-06).
4. **Referred-guest PII**: sending a guest to a peer inherently shares name+phone — reconcile with "guests' private details are never shared" (consent at referral moment `[R]`) — Q-LEG-05.
**Risks.** RSK-B4 (top legal risk); trust erosion if one bad actor games alerts (rate-limit reports, reputation-weight `[R]`).

---

## A12. Auth, RBAC & Multi-tenancy

**Delivered `[F]`.** User table, scrypt, roles owner/reception/housekeeping ("money only for owners"), login rate-limit, per-property access grants, auto-scoping tenant extension, audit of user changes; separate clients = separate everything.
**Gaps (repo-acknowledged + analysis).** Password reset & invites ✖ (GAP-10 — owner hand-sets passwords: unworkable at 25 clients); field-level money masking ✖; RLS ✖; session revocation semantics `[Q]` Q-SEC-03; role list fixed — no custom roles (fine for MVP `[R]`); housekeeping login sees guest names? (privacy-minimal view `[R]`).

---

# TIER B MODULES (compact)

## B1. Today Dashboard
Tiles (occupancy, in-house, check-ins/outs), arrival/departure lists with status ticks, 7-day arrivals, attention banners (cleaning, conflicts), owner-only pending-payments card `[F]`. Edge: date rollover at midnight vs late checkouts `[Q]` Q-OPS-12 (no night-audit concept — acceptable for segment `[R]`, document behaviour). Risks: low. Deps: everything.

## B2. Guests list & profile
Covered under A8/CRM aspects; additional: search by name/phone `[F]`; merge duplicates ✖ (GAP-19); export-my-data ✖ (GAP-8); notes are free-text PII — retention policy applies `[R]`.

## B3. Housekeeping
Derived to-clean + manual flag + assignment + checklist `[F]`. Missing: inspected state, deep-clean cadence, dirty-room booking guard (GAP-20). Permissions: housekeeping role sees only this + Today `[F]`.

## B4. Staff, Shifts, Attendance
Directory/roster/attendance `[F]`. Edge: attendance vs shift mismatch un-flagged `[I]`; no overtime/payroll (Q-OPS-09). Low risk.

## B5. Maintenance & Assets
Requests (priority/assignee/cost/status), assets with service-every-N-days + due flag `[F]`. Edge: request→auto room block linkage ✖ `[R nice]`; cost feeds expenses? `[Q]` Q-FIN-10.

## B6. Inventory & Procurement
Items (unit, low level), in/out movements, low banners; vendors+rating; PO draft→ordered→received; vendor payments + summary `[F]`. Edge: PO received → stock-in automation ✖ `[I]`; no valuation/costing (fine `[R]`).

## B7. Transport & Tours
Drivers, trips (records; dispatch in ROOT) `[F]`; tour partners (commission), tours, tour bookings + summaries `[F]`. Edge: tour commission owed vs paid tracking parity with agents `[I]`.

## B8. Complaints & Reviews
Complaints: category/priority/assignee/status/follow-up `[F]`. Reviews: request tracking + drafted responses `[F]` — drafted by AI? send path? `[Q]` Q-AI-06. Edge: complaint→escalation cross-link `[R]`.

## B9. Travel Agents
Directory (name/phone/commission %, verified, deactivate); per-agent bookings + commission owed this month (derived) `[F]`. Edge: commission payment recording ✖ (owed shown, settlement untracked `[I]`) — Q-FIN-11; rate changes affect past bookings? (snapshot rate at booking `[R]`).

## B10. Messaging Outbox
LogAdapter, `/messages`, auto-drafts (confirmation, pre-arrival, payment reminder), WhatsApp adapter off-by-default, agent queue endpoint `[F]`. Gaps: templates+params+language (GAP-3), two-way inbound (GAP-4), quiet hours/opt-out `[R]` (spam + WhatsApp policy).

## B11. Settings & System Administration
Full table per User Guide `[F]`. Missing admin: backup/restore visibility, health page, data export (client offboarding) — GAP-1/17/23.

## B12. CSV Import
Historical guests+bookings, row-wise conflict-checked `[F]`. Edge: partial-failure reporting, idempotent re-run, template docs `[Q]` Q-OPS-13.

## B13. Audit Log
Sensitive actions: cancellations, refunds, blacklisting, user & consent changes `[F]`. Extend coverage (GAP-15); tamper-evidence (append-only) `[R]`; retention `[Q]`.

## B14. Notifications (cross-cutting)
In-app banners/badges only `[I]`. Missing: push (PWA `PushSubscription` model exists in schema `[F]` — wired? `[Q]` Q-TEC-08), escalation alerts (GAP-14), cron-failure alerts (GAP-5).

## B15. Offline & Sync
Claimed queue-and-sync with clash surfacing `[F — User Guide]`; implementation depth unknown — the single largest fact-gap for iteration 2 (Q-TEC-04). Spec target `[R]`: read cache for Today/Calendar/Guests; write queue for check-in/out, payments (dangerous offline — consider excluding), housekeeping marks; explicit conflict UX.

## B16. PWA / Mobile
Installable, bottom tab bar + FAB, dark/light, accent, density `[F]`. Verify: iOS Safari quirks, low-end Android perf budget (NFR-PRF-01), 2G fallback `[R]`.
