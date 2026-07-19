# Prioritized Roadmap & Phase-wise Delivery Plan
## Discovery doc 17 · v1.0 · 2026-07-16

Anchored to the grant quarters (Q1 already largely satisfied by the delivered baseline). Phases assume the small-team velocity noted in doc 14. Scope reasoning inline; MoSCoW per item.

## Phase 0 — Decisions & verification (2 weeks, parallel)
Stakeholder workshops answer doc 09 ★ questions; iteration-2 codebase audit converts `[INFERRED]` to `[FACT]` (offline truth US-901, community topology US-902, PropertySettings root, PushSubscription wiring). Output: re-baselined backlog. **Everything below assumes this happened.**

## Phase 1 — Production-safety hardening (≈ 3 sprints) → *gate for scaling past first pilots*
**Theme: never lose data, never miss a legal duty, never fail silently.**
- Backup/restore + drills (US-101/102) — Must
- Observability per deployment (US-103) + sync/cron health & warnings (US-104) — Must
- Form C artefact + reminder (US-201); DPDP export/erase, retention default, breach runbook, privacy notice (US-202/203/204) — Must
- OTA modification/cancellation linked updates (US-301); dup suppression (US-305); card-data redaction (US-306) — Must
- Escalation/conflict push notifications (US-501) — Must
- Password reset + invites (US-601/602) — Must
- Money → paise (US-401); staff money masking (US-402) — Must
- Route-level 409 test + housekeeping test (US-903/904) — Must
- Offline audit & honest spec (US-901); community ADR (US-902) — Must
**Exit criteria:** restore drill passed; a simulated Form C, erasure request, and OTA modification each handled end-to-end; push received on phone; zero silent-failure paths in sync.

## Phase 2 — Commercial activation (≈ 3 sprints) → *aligns with grant Q2/Q3: 10–20 pilots + monetisation*
- WhatsApp templates (En/Kha/Hi) live + opt-out/quiet hours (US-502/504) — Must
- Razorpay capture + hold (US-407) — Should (keys dependent)
- GST invoice entity + numbering + tax lines (US-205), server PDF (US-206) — Must for GST clients
- Refund determinism + void/reversal (US-406/404) — Must
- Fleet: scripted provisioning (US-701), onboarding wizard (US-702), staged upgrades (US-703), fleet dashboard (US-105) — Must (this IS the Q3–Q4 milestone machinery)
- Pilot billing process + rate card (US-705) — Must (grant monetisation milestone)
- Session revocation, ID-access logging, keyed hashing, CI raw-SQL guard (US-603/604/605/606) — Should
- i18n string externalization (US-801) — Should (do while UI churn is low)
**Exit criteria:** a new property onboarded < 1 day hands-on; first paid invoices issued; guests receive real WhatsApp confirmations.

## Phase 3 — Scale & experience (≈ 3–4 sprints) → *grant Q4: 25+, scale-readiness*
- Khasi console for core flows (US-802) — Should→Must for inclusion narrative
- Two-way message log (US-503) — Should
- iCal frequency config (US-303), oversell buffer (US-304), per-feed tokens (US-906), removed-event release (per Q-TEC-06) — Should
- OTA payout reconciliation (US-405) — Should
- RLS defence-in-depth (US-403) — Should
- Guest merge (US-907), accessibility pass (US-803), demo tenant (US-706), offboarding export (US-704) — Should/Could
- Nightly-rate snapshot (GAP-22) — Could (enables richer invoices/analytics)
- Room-assignment stance ratified (US-905); if type-level booking chosen → dedicated design spike (constraint redesign — treat as its own Phase-4 epic) — Decision
**Exit criteria:** fleet dashboard green across 25 deployments; support rota + SLA live; Khasi UI in pilot use.

## Future scope / stretch (post-grant-year)
Channel-manager pairing integration (close the oversell window fully); consolidated multi-property owner dashboard; Tally/accounting export; anonymised regional benchmarks (Q-ANL-01); guest self-service portal (view booking, pay, request); housekeeping inspection & deep-clean cadence (GAP-20); payroll linkage; community expansion to cabs/tours operators; regional in-country hosting productised (AMB-01); public booking widget for owner websites.

## Nice-to-have backlog (unscheduled)
Calendar drag-to-move; split-stay support; "why this price" trace; complaint↔escalation cross-link; maintenance→auto-block; PO→stock-in automation; review-response send integration.

## Delivery governance `[REC]`
- Keep the repo's discipline: plan-first, one PR per slice, CI-gated, migrations only via helper.
- Add: canary client for every release; pre-migration backup gate; fixture-corpus CI for the email parser; quarterly restore + security drills.
- Traceability: stories carry FR/GAP IDs (doc 14 already does); RTM (doc 15) re-validated at each phase gate.

## Wireframe recommendations (limited — UI already shipped)
New surfaces needing design: onboarding wizard (US-702), Form C artefact & reminder placement (US-201), sync-health strip on Feeds/Today (US-104), notification settings (US-501), message thread view (US-503), fleet dashboard (internal, US-105). Recommend reusing the existing navy/teal design system and mobile bottom-tab patterns documented in ARCHITECTURE → UI.
