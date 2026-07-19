# Product Backlog
## Discovery doc 14 · v1.0 · 2026-07-16

Scope note: the delivered feature set (README/ROADMAP) is treated as the baseline; this backlog covers the **delta to enterprise quality** — hardening, activation, compliance, scale — plus verification stories for claims that need code-audit proof. Table columns are Jira/ADO-import-ready.

**Definition of Ready (all stories):** open questions referenced are answered; acceptance criteria agreed; test data identified; touches to the constraint/migration machinery flagged for senior review.
**Definition of Done (all stories):** code + tests (unit; route-level where API changes) green in CI; migration via `db:migrate:new` only; docs updated (USER-GUIDE/ARCHITECTURE as relevant); audit/RBAC respected; deployed to a pilot-mirror environment; demoed.

Priority P0 (production-safety) > P1 (scale/commercial) > P2 (quality) > P3 (enhancement). Points: Fibonacci.

## Epic E1 — Production Safety & Operability (GAP-1, 5, 17)
| ID | Story | Acceptance criteria (Given/When/Then) | Refs | Pri | Pts |
|----|-------|----------------------------------------|------|-----|-----|
| US-101 | As MindBit ops, I need automated daily backups with an offsite copy per client DB, so a client can survive data loss. | G a client deployment; W the nightly job runs; T a restorable snapshot exists offsite, retention 30d, and failure alerts ops. | GAP-1, RSK-08 | P0 | 5 |
| US-102 | As MindBit ops, I need a documented, drilled restore runbook. | G a snapshot; W the runbook is executed on a scratch instance quarterly; T RTO ≤ 4h verified and logged. | GAP-1 | P0 | 3 |
| US-103 | As MindBit ops, I need error tracking + uptime checks on every deployment. | G an unhandled error or downtime; W it occurs; T it appears in the monitoring tool within 5 min tagged by client, and UI shows an incident ID. | GAP-17 | P0 | 5 |
| US-104 | As an owner, I can see sync health (last success per iCal feed, forwarder heartbeat, cron status) and get warned when stale. | G a feed that hasn't synced > 12h; W I open Feeds/Today; T a visible warning shows age; and a push/alert fires (with E5). | GAP-5, BR-AVL-05 | P0 | 5 |
| US-105 | As MindBit ops, I need a fleet dashboard (version, health, cron, backup status across clients). | G ≥ 2 deployments; W I open the dashboard; T each shows version+health+last backup+last sync, red on breach. | GAP-18 | P1 | 8 |

## Epic E2 — Compliance: DPDP, Form C, GST (GAP-7, 8, 11)
| ID | Story | Acceptance criteria | Refs | Pri | Pts |
|----|-------|----------------------|------|-----|-----|
| US-201 | As an owner, I can produce a pre-filled Form C artefact for a foreign guest and track submission. | G a checked-in foreign guest; W I tap "Form C"; T a print-ready artefact with the 13 fields renders; a due-in-24h reminder exists until "submitted" is ticked (audited). | GAP-7, Q-LEG-02 | P0 | 5 |
| US-202 | As an owner, I can export all data held about a guest, and erase it (where no statutory hold). | G a guest requests erasure; W I trigger it; T PII is removed/anonymised, bookings retain non-identifying financial integrity, action audited. | GAP-8 | P0 | 8 |
| US-203 | As MindBit, ID-scan retention has a sane default and the purge provably runs. | G a new property; W created; T `idRetentionDays` defaults (e.g. 180); purge logs deletions; owner notified of policy. | BR-GST-05 | P0 | 3 |
| US-204 | As MindBit, we have a breach-notification runbook and guest-facing privacy notice (incl. AI/US-cloud processing). | Docs approved by counsel; notice linked in app. | NFR-PRV-01/04 | P0 | 3 |
| US-205 | As an owner (GST-registered), invoices carry sequential per-FY numbers, GST lines, and are stored immutably. | G GSTIN configured; W invoice issued; T `Invoice` record with number series, tax lines per rate, snapshot; reprint = identical. | GAP-11, Q-FIN-02 | P1 | 8 |
| US-206 | As a guest-facing doc, invoices render as server-side PDFs. | Pixel-stable PDF, phone-downloadable. | GAP-11 | P2 | 5 |

## Epic E3 — OTA Ingestion completeness (GAP-2, 6, 24; RSK-13)
| ID | Story | Acceptance criteria | Refs | Pri | Pts |
|----|-------|----------------------|------|-----|-----|
| US-301 | As reception, modification/cancellation OTA emails match the existing booking and guide me through applying the change. | G a booking with otaRef X; W a modification email for X is ingested; T the pending item links to the booking, shows a diff, "Apply" updates via the normal conflict-checked path. | GAP-2 | P0 | 8 |
| US-302 | As MindBit, a fixture corpus of real OTA emails (per OTA, per type) gates parser changes in CI. | G corpus collected (Q-OTA-02); W parser changes; T CI runs fixtures, extraction accuracy reported. | RSK-13 | P1 | 5 |
| US-303 | As an owner, I can set iCal sync frequency (up to hourly). | Configurable; respects OTA politeness; health surfaced (US-104). | GAP-6 | P2 | 3 |
| US-304 | As an owner, I can hold back a last-room buffer per room type from agent/shared availability. | G buffer=1 on Deluxe(3); W 2 booked; T agent/community availability reports 0; direct booking still possible with warning. | GAP-24 | P2 | 5 |
| US-305 | As reception, duplicate OTA confirmations never create two bookings. | G booking with otaRef X exists; W same-ref email ingested; T flagged duplicate, no new pending create. | BR-OTA-03 | P1 | 3 |
| US-306 | As MindBit, ingested emails have card data redacted before storage. | Fixture with virtual card; stored record contains none of it. | ASM-18, Q-OTA-03 | P1 | 2 |

## Epic E4 — Money correctness (GAP-9, 12, 13; Q-FIN-*)
| ID | Story | Acceptance criteria | Refs | Pri | Pts |
|----|-------|----------------------|------|-----|-----|
| US-401 | As engineering, money is integer paise end-to-end with a typed money util. | All money fields migrated; property tests on arithmetic; CSVs/invoices unchanged to the rupee. | GAP-9 | P0 | 8 |
| US-402 | As an owner, staff API responses never contain money fields. | G reception session; W any endpoint returns a reservation; T `grossAmount` etc. absent; contract tests per role. | GAP-12 | P0 | 5 |
| US-403 | As engineering, Postgres RLS enforces property scoping as defence-in-depth. | RLS policies on tenant tables keyed to session property; raw-SQL leak test proves containment. | GAP-12, RSK-17 | P1 | 8 |
| US-404 | As an owner, payment corrections are void+reversal with audit (no silent edits). | Edit disabled; void creates reversing entry; both audited. | BR-PAY-05, Q-FIN-04 | P1 | 3 |
| US-405 | As an owner, I can record OTA payouts and see owed-vs-received per OTA. | Payout entity matched to bookings; Finance shows variance. | GAP-13 | P2 | 5 |
| US-406 | As an owner, refund rules are deterministic (base, caps) per ratified answers. | Ladder base per Q-FIN-07; refund ≤ paid enforced; OTA-collect path documented. | BR-CANC-03/04/05 | P1 | 3 |
| US-407 | As an owner, Razorpay capture + room-hold works when keys are provided. | Idempotent webhook (replay-safe test); hold expires → release; constraint untouched. | FR-PAY-5 | P1 | 8 |

## Epic E5 — Notifications & Messaging activation (GAP-3, 4, 14)
| ID | Story | Acceptance criteria | Refs | Pri | Pts |
|----|-------|----------------------|------|-----|-----|
| US-501 | As an owner, I receive a push notification for high-severity escalations and new conflicts. | G subscribed device; W event fires; T push within 1 min; deep-links to item; per-event toggles in Settings. | GAP-14, BR-AI-05 | P0 | 5 |
| US-502 | As MindBit, WhatsApp templates (En/Kha/Hi) for confirmation, pre-arrival, payment reminder are approved and parameterised. | Templates submitted+approved; outbox sends real messages with params; language chosen per guest. | GAP-3 | P1 | 8 |
| US-503 | As an owner, guest replies are visible in a unified message log. | Inbound webhook stores replies; thread view per guest; ownership per Q-AI-04 decision. | GAP-4 | P2 | 5 |
| US-504 | As a guest, I can opt out of messages; sends respect quiet hours. | STOP handling; no sends 22:00–07:00 except OTP-class. | RSK-15 | P1 | 3 |

## Epic E6 — Auth & access hardening (GAP-10; Q-SEC-*)
| ID | Story | Acceptance criteria | Refs | Pri | Pts |
|----|-------|----------------------|------|-----|-----|
| US-601 | As a staff member, I join via an email invite and set my own password. | Invite → expiring link → set password → role/property pre-assigned. | GAP-10 | P0 | 5 |
| US-602 | As any user, I can reset a forgotten password. | Reset link, single-use, rate-limited. | GAP-10 | P0 | 3 |
| US-603 | As an owner, disabling a user or changing role revokes their sessions. | Per Q-SEC-03 ratified semantics; test proves stale session rejected. | AMB-21 | P1 | 3 |
| US-604 | As an owner, ID-document access is logged. | Every view/download → audit entry; owner-visible. | Q-SEC-04, GAP-15 | P1 | 2 |
| US-605 | As engineering, shared-list phone hashing uses a keyed hash. | Pepper per network; enumeration test infeasible; migration for existing hashes. | NFR-SEC-09 | P1 | 3 |
| US-606 | As engineering, CI guards raw SQL for tenant scoping. | Lint rule / grep-gate fails PRs with unscoped tenant-table raw SQL. | NFR-SEC-06 | P1 | 2 |

## Epic E7 — Fleet & onboarding (GAP-18, 23, 27, 30)
| ID | Story | Acceptance criteria | Refs | Pri | Pts |
|----|-------|----------------------|------|-----|-----|
| US-701 | As MindBit ops, I can provision a new client (deploy+DB+seed+env) with one scripted command. | New deployment live < 2h hands-on; checklist auto-verified. | GAP-18, Q-DEP-01 | P1 | 8 |
| US-702 | As a new owner, a setup wizard walks me through property, rooms, channels, policies, staff. | First-run wizard completes to a bookable state without support. | GAP-18 | P1 | 8 |
| US-703 | As MindBit ops, upgrades roll out across the fleet staged (canary → all) with pre-migration backup gates. | Scripted; halt-on-failure; version visible in fleet dashboard. | RSK-09 | P1 | 5 |
| US-704 | As a client, I can receive a complete export of my data on request (offboarding). | DB export + documents + CSVs delivered; runbook. | GAP-23 | P2 | 3 |
| US-705 | As MindBit, pilot billing operates (even manually) with a rate card. | Pricing sheet ratified (Q-BUS-03); invoices issued; revenue tracked vs grant milestone. | GAP-27 | P1 | 2 |
| US-706 | As sales, a seeded demo tenant showcases the product safely. | Demo data realistic; reset script. | GAP-30 | P2 | 2 |

## Epic E8 — Localization & accessibility (GAP-16, 21)
| ID | Story | Acceptance criteria | Refs | Pri | Pts |
|----|-------|----------------------|------|-----|-----|
| US-801 | As engineering, all UI strings are externalized (i18n framework). | No hardcoded user-facing strings; language switch scaffolding. | GAP-16 | P1 | 8 |
| US-802 | As a Khasi-speaking operator, core flows are available in Khasi. | Today/Calendar/Booking/Payments/Housekeeping translated; reviewed per Q-L10N-03. | GAP-16 | P2 | 8 |
| US-803 | As any user, core flows meet WCAG 2.1 AA basics. | Contrast, touch targets ≥ 44px, labels; audit checklist passes. | GAP-21 | P2 | 5 |

## Epic E9 — Verification & spec-truth (GAP-25, 26, 29; iteration-2 inputs)
| ID | Story | Acceptance criteria | Refs | Pri | Pts |
|----|-------|----------------------|------|-----|-----|
| US-901 | As the team, offline behaviour is audited and specified honestly. | Doc: which reads cached, which writes queue, conflict UX; User Guide corrected if overstated; 2G field test. | GAP-25, Q-TEC-04 | P0 | 5 |
| US-902 | As the team, community topology is documented as an ADR. | Where registries live, who controls, failure modes; counsel-reviewed. | GAP-26, Q-LEG-03 | P0 | 3 |
| US-903 | As engineering, route-level test: booking create overlap → 409 (repo's own top test gap). | Vitest route test green; guards db-errors sniffing. | NFR-MNT-02 | P0 | 2 |
| US-904 | As engineering, housekeeping derivation has a test. | Checkout ⇒ task appears; mark-clean ⇒ ready. | NFR-MNT-02 | P1 | 2 |
| US-905 | As the team, the room-assignment product stance (fixed room vs type-level) is ratified and recorded. | Decision workshop output; if type-level chosen, spike estimates constraint redesign. | GAP-29, Q-OPS-05 | P1 | 2 |
| US-906 | As engineering, per-feed iCal tokens replace the single token. | Rotation per feed; old URLs invalidated gracefully. | ROADMAP suggestion | P2 | 3 |
| US-907 | As engineering, guest merge tool resolves duplicates with audit. | Merge preserves stays/LTV; irreversible warning; audited. | GAP-19 | P2 | 5 |

## Backlog summary
P0: 15 stories ≈ 67 pts · P1: 19 ≈ 85 pts · P2: 11 ≈ 46 pts. At a sustained 20–25 pts/sprint (small team), P0 ≈ 3 sprints — aligning with the "before wider pilot rollout" window in doc 17.
