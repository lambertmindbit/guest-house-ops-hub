# Business Requirements Document (BRD)
## Guest House Operations Hub — ROOT Platform PMS Layer

| | |
|---|---|
| **Document** | BRD-GHOH-001 |
| **Version** | 1.0 (Discovery Pass 1 — pre-codebase-audit) |
| **Date** | 2026-07-16 |
| **Author** | Discovery analysis (Claude, acting Sr. PM / BA / Solution Architect) |
| **Sources** | MindBit Solutions Pitch Deck (PRIME Meghalaya Innoventure Grant 2025–26); USER-GUIDE (v. current); repo README.md; docs/ROADMAP.md |
| **Status** | DRAFT — pending stakeholder review of Open Questions (doc 09) |

**Evidence tagging convention (used across the whole discovery package):**
`[FACT]` — stated in an authoritative source · `[INFERRED]` — reasonable deduction, needs confirmation · `[REC]` — analyst recommendation · `[OPEN-Q]` — must be answered by stakeholders (cross-referenced to doc 09).

---

## 1. Executive Summary

MindBit Solutions LLP (Shillong, Meghalaya) is building **ROOT — Regional Orchestration Of Tasks** — a localized, multilingual AI infrastructure for Meghalaya's tourism and transport operators `[FACT]`. The **Guest House Operations Hub** is the property-management layer of ROOT: a mobile-first web application giving a small guest-house owner a single source of truth for bookings, calendar, guests, housekeeping, pricing, payments, finance, staff, facilities, and a regional community network, across direct, WhatsApp, and OTA (Booking.com / Agoda / MakeMyTrip) channels `[FACT]`.

The product is deliberately **not a channel manager**: real-time OTA connectivity APIs are gated to certified channel-manager partners and are unavailable to a single small property `[FACT]`. Instead the hub ingests OTA bookings through the owner's own confirmation emails and iCal feeds, exports availability via free iCal links, and owns everything the OTAs do not — the unified calendar, guest CRM, operational workflows, pricing decisions, and finances `[FACT]`.

A substantial prototype already exists (55+ Prisma models; six product milestones plus three gap-analysis phases, multi-property tenancy, RBAC, an AI-agent seam, and a community network, all reported "in production on main") `[FACT — per README/ROADMAP; to be verified against code in iteration 2]`. This BRD treats that prototype as a **starting point, not a finished product**: the purpose of this discovery package is to identify what exists, what is missing, what is ambiguous, and what must be confirmed before the product is deployed at the scale the grant plan commits to (25+ businesses in 12 months) `[FACT — pitch deck]`.

**Headline findings** (detailed in the Gap Analysis, doc 06):

1. The **operational core is unusually strong** for a prototype — DB-enforced double-booking prevention, derived availability, and a human-in-the-loop AI seam are correct-by-design decisions that most commercial PMS products get wrong. `[FACT/REC]`
2. The largest risks are **not features but operations**: fleet management of one-deployment-per-client, backup/DR, monitoring, support model, and MindBit's own billing/monetisation tooling are undefined. `[INFERRED/REC]`
3. There is a **positioning contradiction** — the product is described as "self-hosted / locally owned data" while the reference deployment is Vercel + Supabase + Google Cloud Run (US/global cloud). `[FACT — both statements appear in sources; contradiction is analyst finding]`
4. **Compliance is under-specified**: India's DPDP Act 2023 obligations for guest PII and ID scans, GST invoicing rules, and the Form C (FRRO) submission workflow are partially represented in the product but have no documented compliance position. `[INFERRED]`
5. The **community network (shared scam / bad-guest lists)** is innovative but carries the package's highest legal exposure and needs a governance policy before scale. `[REC]`
6. The **multilingual (Khasi/Hindi/English) promise applies to the AI guest layer but not to the operator console UI**, which is English-only per the User Guide — a localization gap against the pitch's inclusion claims. `[INFERRED — verify in code]`

## 2. Business Context

### 2.1 The problem `[FACT — pitch deck]`
Small operators in Meghalaya run on manual coordination: bookings arrive by phone call or WhatsApp (often after hours and missed), the operator reads/interprets/decides manually, drivers are assigned by phone with no shared status, Khasi↔English translation happens by hand, and records live in hand-kept spreadsheets — no history, no analytics, no source of truth. Operators lose business to this fragility.

### 2.2 The solution thesis `[FACT — pitch deck]`
An always-on, multilingual AI layer (Khasi · Hindi · English, voice and text) that sits between the customer and the operator: multilingual chat, booking & OTP automation, driver dispatch & fallback, and a plain-language admin console. ROOT is explicitly *not* an aggregator (not OYO/MMT/Uber/Ola); it is the operational layer small operators use to run their own work. The stated moat: no national aggregator is built to serve the Khasi/regional operational level.

### 2.3 Where the Ops Hub fits `[FACT — README/User Guide]`
The Ops Hub is the deterministic system-of-record the AI agents connect to through a token-gated seam. Agents can query availability, quote, book (through the same DB-guarded transaction as a human), queue messages, and file escalations — but never touch money or the calendar directly; sensitive actions always route to a human queue.

### 2.4 Funding & delivery context `[FACT — pitch deck]`
PRIME Meghalaya Innoventure Grant ask: ₹15,00,000; founder co-financing ₹4,46,722; total ₹19,46,722. 12-month milestone plan: Q1 foundation + 3–5 pilots → Q2 cab module + 10 pilots → Q3 console & monetisation + 15–20 → Q4 scale-readiness, 25+ businesses. Milestones support tranche-based fund release. Impact commitments: 4–6 local jobs, 25+ businesses in year one, Khasi/multilingual inclusion, locally-owned data and customer relationships.

**Business implication `[REC]`:** the grant milestones convert product gaps into *deadline-bound* obligations. Anything that blocks onboarding a new property in hours rather than days (setup wizard, fleet deploy tooling, training material) is on the critical path for Q3–Q4 milestones even though it is invisible in the feature list.

## 3. Business Objectives

| ID | Objective | Source | Measure |
|----|-----------|--------|---------|
| BO-01 | Give each property a single source of truth for all bookings across channels | Pitch, README | 100% of the property's bookings (direct + OTA) recorded in the hub |
| BO-02 | Make internal double-bookings impossible and cross-channel double-bookings rare | README, User Guide | 0 internal double-bookings (DB-enforced); cross-channel oversell incidents/quarter |
| BO-03 | Capture bookings that today are lost after-hours or in translation | Pitch | After-hours booking conversion rate via AI assistant |
| BO-04 | Replace the expensive parts of a commercial channel manager | README | Monthly software cost to owner vs. channel-manager benchmark |
| BO-05 | Show true profitability per channel (net of commission and expenses) | User Guide | Owner can state net-by-channel for any period |
| BO-06 | Reduce the owner's need to be available 24/7 | Pitch | % guest interactions resolved by AI without escalation |
| BO-07 | Keep data and customer relationships locally owned | Pitch | Data residency / ownership position documented and true |
| BO-08 | Build a regional trust network (referrals, scam/bad-guest alerts, shared vendors) | User Guide | Connected peers per property; referral volume; fraud losses avoided |
| BO-09 | Deploy to 25+ Meghalaya businesses in 12 months on grant milestones | Pitch | Businesses live per quarter vs. milestone plan |
| BO-10 | Sustain MindBit through monetisation (Q3 milestone) | Pitch | Paying clients; revenue vs. plan `[OPEN-Q: pricing model undefined — Q-BUS-03]` |

## 4. Stakeholders

| Stakeholder | Role / interest | Responsibilities in this project |
|---|---|---|
| **Property owner** | Primary customer & primary user; controls money, settings, community participation | Validates workflows, pricing, cancellation policy, ID rules; signs off pilot |
| **Reception staff** | Daily bookings, check-in/out, payments, guest handling | UAT of front-desk flows; feedback on speed on low-end phones |
| **Housekeeping staff** | Cleaning queue, room readiness | UAT of housekeeping; validates checklist realism |
| **Guests (domestic / foreign)** | Indirect users via AI chat, UPI links, invoices, messages | N/A (represented via owner + research) |
| **MindBit Solutions LLP** | Product owner, deployer, support organisation | Roadmap, fleet operations, compliance position, monetisation |
| **PRIME Meghalaya / grant committee** | Funder; milestone verification | Tranche release against milestones |
| **OTA platforms** (Booking.com, Agoda, MMT) | Constraint-setters (ToS, iCal availability, email formats) | None (external dependency; formats change without notice) |
| **Peer properties (community network)** | Counterparties for referrals & shared lists | Opt-in participation; evidence standards for reports |
| **Travel agents (B2B)** | Bring bookings for commission | Confirm commission terms & settlement expectations |
| **Government (FRRO/police, GST)** | Form C for foreign guests; tax compliance | External requirements the product must serve |
| **Meta (WhatsApp), Google (Gemini), Supabase, Vercel, Razorpay** | Platform dependencies | ToS, template approvals, pricing, availability |

## 5. Current State (As-Is)

### 5.1 Without the product `[FACT — pitch deck]`
Manual phone/WhatsApp intake, hand translation, paper/spreadsheet records, no shared driver status, no analytics, missed after-hours bookings.

### 5.2 The prototype today `[FACT — README/ROADMAP; verify in iteration 2]`
Delivered and reported in production: operations core (bookings, calendar, Today board, guests, housekeeping, admin); advisory pricing engine + rate calendar; check-in/out; guest CRM (history, LTV, blacklist, ID flags, C-Form fields); finance (per-channel net, expenses); analytics (occupancy/ADR/RevPAR/mix + CSV); invoices (browser print); bookings list; multi-property with shared-guest CRM; RBAC (owner/reception/housekeeping) + login rate limiting; staff/shift/attendance; maintenance + assets; inventory; vendors + procurement; transport records; tours; groups/folios; complaints; reviews tracker; audit log; travel agents; cancellation refund ladder; UPI pay-link + QR; payment verification checklist; scam numbers; community network (connections, grants, directory, referrals + credit ledger, verified scam/bad-guest sharing with hashed numbers, evidence, appeal, expiry); iCal import/export with daily sync; OTA email paste-parse Inbox + webhook seam + two ready forwarders; AI agent seam (availability/quote/book/escalate/message) with HITL escalations; assistant sidecar (Python, Google ADK + Gemini, Cloud Run) with personas, fallback, runtime policies, diagnostics, tests.

Groundwork built but **off by default**: automatic email ingestion (token + forwarder), WhatsApp Cloud API adapter (needs credentials + Meta-approved templates), Razorpay gateway + hold (needs merchant keys), guest-ID document storage (needs bucket + env).

Deferred / known debt (the repo's own canonical list): message *delivery* default-off; server-side PDFs; rates-to-OTA push (impossible by rule); whole-rupee `number` money math; per-instance rate limiter; route-handler test gaps; field-level money masking absent; no Postgres RLS; no user invites / password reset; ID-retention purge inert until configured; raw-SQL tenant-scoping discipline required.

### 5.3 As-is assessment `[REC]`
The prototype is a **late-stage MVP with production-hardening gaps**, not an early prototype. The correctness core (exclusion constraint, derived availability, HITL AI) is enterprise-grade in design. The unfinished layer is everything *around* the software: compliance posture, operations at fleet scale, resilience, observability, and the commercial machinery.

## 6. Future State (To-Be)

A property owner in Meghalaya runs the entire guest house from a phone `[FACT — product intent]`:

- Every booking — walk-in, WhatsApp, website, or OTA email — lands in one calendar within minutes, automatically parsed and human-confirmed; internal double-booking is impossible and the cross-channel window is minimised by automated iCal sync plus (optionally) one paired channel manager.
- The AI assistant answers guests in Khasi, Hindi, or English around the clock; anything sensitive lands in the owner's escalation queue with a summary and one-tap actions.
- Money is collected via UPI QR/link or gateway, verified against fake-payment scams, reconciled per channel net of commission, and exported for the accountant; invoices are GST-correct.
- Foreign-guest Form C data is captured at check-in and produces the artefact the local FRRO process requires `[OPEN-Q on exact requirement — Q-LEG-02]`.
- Housekeeping, maintenance, inventory, staff attendance and vendor spend run as lightweight queues with accountability.
- The property participates, opt-in, in a regional trust network: overflow referrals with reciprocal credit, verified scam/bad-guest alerts, shared vendor/driver lists.
- MindBit operates a fleet of isolated per-client deployments with monitored health, tested backups, one-command onboarding, in-Khasi training material, and a subscription billing relationship.

## 7. Key Business Processes (summary — full detail in doc 04 Workflows)

1. Direct/WhatsApp/walk-in booking capture → conflict-checked confirmation → automated guest messaging.
2. OTA booking ingestion (email parse → review → create) and iCal import (busy blocks).
3. Availability push-out (iCal export; manual extranet updates; optional channel manager).
4. Arrival: ID verification (+C-Form for foreigners) → check-in → in-house services.
5. Departure: balance settlement → invoice → check-out → housekeeping task.
6. Payments: deposit/advance → verification checklist (UPI/bank) → balance → refund ladder on cancellation.
7. Pricing: rules produce advisory nightly rates → owner pins overrides → suggested price pre-fills bookings.
8. Finance close: expenses, per-channel commission, net profit, CSV export.
9. Facilities loops: maintenance requests, asset service schedules, inventory in/out, procurement.
10. Team: roster, attendance, housekeeping assignment.
11. Community: connect → grant shares → refer overflow → credit ledger → verified alert sharing.
12. AI: guest conversation → tool calls through the seam → escalation → human action.

## 8. Scope

### 8.1 In scope (this product)
Everything in §5.2 plus the hardening/completion workstreams defined in the Gap Analysis (doc 06) and phased in the Roadmap (doc 17): activation of email ingestion, WhatsApp delivery, gateway payments, ID storage; compliance workstream (DPDP, GST invoice fields, Form C artefact); operations workstream (backup/DR, monitoring, fleet onboarding); localization of the operator UI; MindBit-side billing.

### 8.2 Out of scope (permanently, by rule) `[FACT — hard rules]`
- Scraping / browser automation against OTA extranets.
- Direct Booking.com / Agoda / MakeMyTrip connectivity API integration.
- Storing availability as a mutable counter.
- Weakening the DB double-booking constraint.
- Acting as an OTA/aggregator (ROOT is an operational layer, not a marketplace).

### 8.3 Out of scope (this product, handled elsewhere in ROOT)
- Live cab dispatch (separate ROOT module; hub keeps transport *records* only) `[FACT]`.
- The AI assistant's own runtime (separate Python sidecar service) `[FACT]`.

### 8.4 Future scope / stretch (doc 17 has the full phased plan)
Channel-manager pairing; owner mobile push notifications; guest self-service portal; payment gateway alternatives; accounting-software export (Tally); occupancy-tax/GST filings support; Khasi operator UI; offline-first hardening; community-network expansion beyond guest houses (homestays, cabs, tours).

## 9. Business Risks (top-line — full register in doc 07)

| ID | Risk | Prob. | Impact |
|----|------|-------|--------|
| RSK-B1 | Fleet operations (one deployment per client) don't scale to 25+ clients with a 3-founder team | High | High |
| RSK-B2 | Grant milestones slip because onboarding/monetisation tooling was never scoped | Med | High |
| RSK-B3 | "Self-hosted / locally-owned data" positioning contradicted by US-cloud reference stack | Med | Med–High (grant/reputation) |
| RSK-B4 | Shared bad-guest/scam lists create defamation or DPDP liability | Med | High |
| RSK-B5 | WhatsApp/Meta template rejection blocks the messaging value proposition | Med | Med |
| RSK-B6 | OTA changes (email format, iCal removal) silently break ingestion | High | Med |
| RSK-B7 | Data loss at a pilot property (no documented backup/restore) destroys trust regionally | Low–Med | Very High |

## 10. Assumptions (top-line — full register in doc 10)
Single-timezone (IST) operation; INR-only money; smartphone + intermittent connectivity as baseline; owner literate in English for the console (until localized); OTA iCal availability varies by listing type; guest consent obtainable at check-in; Meta/Google/Supabase terms remain compatible.

## 11. Success Metrics

| Metric | Target (proposed `[REC]` — confirm with stakeholders) |
|---|---|
| Internal double-bookings | 0 (hard invariant) |
| Cross-channel oversell incidents | < 1 / property / quarter with iCal sync active |
| Time to onboard a new property | < 1 day by Q4 of grant plan |
| OTA email → booking created | < 10 min with forwarder active; 100% human-reviewed |
| % guest messages handled by AI without escalation | > 60% by Q4 |
| Owner weekly time on admin | −50% vs. baseline interview |
| Monthly cost to owner vs. channel manager | ≤ 50% |
| Properties live | 3–5 (Q1) → 10 (Q2) → 15–20 (Q3) → 25+ (Q4) `[FACT — grant plan]` |
| Restore-from-backup drill | Quarterly, < 4h RTO `[REC]` |

## 12. Approval & next steps
1. Stakeholders answer the Question Log (doc 09) — the ambiguities in doc 08 block design decisions.
2. Iteration 2: codebase/architecture audit to convert `[INFERRED]` items to `[FACT]`.
3. Backlog (doc 14) groomed against the answers; roadmap (doc 17) re-baselined to grant quarters.
