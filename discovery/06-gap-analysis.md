# Gap Analysis Report
## Discovery doc 06 · v1.0 · 2026-07-16

Gaps between the prototype (as documented in README/ROADMAP/User Guide) and an enterprise-quality, deployable-at-scale product. Severity: **S1** blocks safe production / legal exposure · **S2** blocks scale to 25+ clients or a core business objective · **S3** material quality/UX gap · **S4** enhancement. "Repo-ack" = the repo's own docs already acknowledge it (credibility point — these are honest docs).

| ID | Gap | Area | Severity | Repo-ack | Impact / rationale | Recommendation | MoSCoW |
|----|-----|------|----------|----------|--------------------|----------------|--------|
| GAP-1 | No documented, tested backup & restore (RPO/RTO undefined; restore never drilled) | Ops | **S1** | ✖ | A pilot losing its bookings DB is a region-wide trust kill (RSK-B7) | Nightly automated backups + offsite copy + quarterly restore drill + runbook | Must |
| GAP-2 | OTA modification/cancellation emails have no linked-update path | Ingestion | **S1** | partial | Unapplied changes ⇒ ghost availability or oversell — defeats BO-02 | Parse mod/cancel types; match by ota_ref; guided update flow | Must |
| GAP-3 | WhatsApp templates (multi-language) + param plumbing missing — delivery can't turn on | Messaging | S2 | ✅ | Messaging value prop (confirmations, reminders) inert; Meta approval lead time | Template catalogue (En/Kha/Hi), submit early, params through seam | Must |
| GAP-4 | No two-way message thread visible to operator (outbox only) | Messaging | S3 | partial | Guest replies invisible in hub; context split with assistant | Decide owner (hub vs assistant UI) then build inbound log | Should |
| GAP-5 | Silent failure of crons/forwarders/iCal fetches (no alerts, no last-success surfacing) | Ops/Sync | **S1** | ✖ | Staleness is invisible precisely when it causes double-books | Health timestamps per feed/cron + owner-visible warning + fleet alert | Must |
| GAP-6 | iCal sync only daily; lag window larger than necessary | Sync | S3 | ✖ | Bigger oversell window than the free method requires | Configurable frequency (e.g. hourly) within OTA politeness | Should |
| GAP-7 | Form C: fields captured but no artefact/reminder/submission support | Compliance | **S1** | ✖ | Legal duty within 24h of foreign arrival; capture without output ≈ non-compliance | Printable pre-filled Form C + 24h reminder + submitted flag (Q-LEG-02) | Must |
| GAP-8 | DPDP data-principal rights absent (export/erase guest data); breach procedure absent; retention default = indefinite | Compliance | **S1** | partial (purge inert noted) | DPDP 2023 exposure across every client MindBit deploys | Guest data export+delete; sane retention default; breach runbook; notice text | Must |
| GAP-9 | Money = whole-rupee float `number` | Finance | S2 | ✅ | Rounding/precision errors as finance features grow; GST math needs paise | Migrate to integer paise (or Decimal) with typed money util | Must (before gateway/GST) |
| GAP-10 | No password reset / user invites; owner hand-sets passwords | Auth | S2 | ✅ | Unworkable + insecure at 25 clients × staff churn | Email invite + reset flow; force-change on first login | Must |
| GAP-11 | Invoices not statutory-grade: no stored invoice entity, no sequential numbering, no GST tax lines, browser-print only | Finance | S2 | partial (PDF deferred) | GST-registered properties can't legally invoice from the product | `Invoice` entity (immutable snapshot, per-FY series) + GST lines + server PDF | Must (for GST clients) |
| GAP-12 | Authorization depth: no field-level money masking; no Postgres RLS; raw-SQL scoping by convention only | Security | S2 | ✅ | Staff API responses leak money; single missed scope leaks across owner's properties | Serializer-level masking; RLS defence-in-depth; CI raw-SQL guard | Must |
| GAP-13 | No OTA payout reconciliation (OTA-collect bookings: owed vs received untracked) | Finance | S3 | ✖ | Owner can't see if Booking.com actually paid | Payout record + match to bookings | Should |
| GAP-14 | No push/WhatsApp notification for escalations & conflicts (badge only) | AI/Notify | S2 | ✖ | Defeats "owner needn't be available 24/7" (BO-06); PushSubscription model exists unused? | Wire web-push (+optional WhatsApp-to-owner) for high-severity events | Must |
| GAP-15 | Audit log covers only a narrow action set; no tamper-evidence; ID-document access not logged | Security | S3 | ✖ | Investigations & DPDP accountability need breadth | Extend coverage (payments edits, settings, shares, ID views); append-only | Should |
| GAP-16 | Operator console is English-only — Khasi/Hindi UI absent | Localization | S2 | ✖ (inferred) | Pitch's inclusion promise applies only to guest AI; staff literacy varies | i18n framework now (strings extraction), Khasi pack with pilot feedback | Should→Must for grant optics |
| GAP-17 | No observability: error tracking, structured logs, uptime monitoring per deployment | Ops | **S1** | ✖ | Fleet of isolated deployments with no telemetry = support blindness | Sentry (or similar) + uptime checks + log drain, per client | Must |
| GAP-18 | No fleet tooling: onboarding automation, version/health dashboard, coordinated upgrades across N deployments | Ops | S2 | ✖ | One-deployment-per-client × 25 clients × 3 founders = milestone risk (RSK-B1/B2) | Onboarding wizard + IaC template + fleet dashboard + scripted upgrades | Must (Q3–Q4) |
| GAP-19 | No guest merge / duplicate resolution | CRM | S3 | ✖ | Phone changes fracture history, LTV, reliability | Merge tool with audit | Should |
| GAP-20 | Housekeeping lacks inspected state, deep-clean cadence, dirty-room booking guard | Housekeeping | S4 | ✖ | Quality ceiling for larger pilots | Optional inspection step + recurring tasks | Could |
| GAP-21 | Accessibility unassessed (WCAG 2.1 AA) | UX | S3 | ✖ | Public-facing artefacts + staff diversity; grant optics | Audit core flows; fix contrast/targets/labels | Should |
| GAP-22 | No per-night rate breakdown on a booking (single amount) | Booking/Finance | S3 | ✖ | Limits invoice lines, season analytics, partial-stay refund math | Store nightly rate snapshot at creation | Should |
| GAP-23 | No client data-export / offboarding path (data ownership promise) | Ops/Trust | S2 | ✖ | "Locally owned data" must include leaving with it | Full-export (DB dump + docs) runbook/feature | Should |
| GAP-24 | No oversell safety-buffer feature (guide advises it manually) | Sync | S3 | ✖ | The one automatable mitigation for the iCal lag window | Per-type "hold back N units from shared/agent availability" | Should |
| GAP-25 | Offline claims unverified: queue depth, conflict UX, which writes are safe offline | PWA | S2 | ✖ | Patchy-signal Meghalaya is the stated context; silent data loss risk if claims overstate | Iteration-2 code audit → explicit offline spec (doc 03 B15) | Must (verify) |
| GAP-26 | Community network cross-deployment topology undocumented (where do shared registries live?) | Architecture | S2 | ✖ | Legal controller-ship, availability, and trust model all hinge on it | Architecture decision record + doc (Q-LEG-03) | Must (document) |
| GAP-27 | No MindBit-side billing/subscription tooling (monetisation is a Q3 grant milestone) | Business | S2 | ✖ | Can't invoice clients ⇒ milestone slip | Even manual process + pricing sheet by Q3; product later | Must (business) |
| GAP-28 | Positioning contradiction: "self-hosted / locally-owned" vs Vercel+Supabase+Cloud Run reference stack | Positioning | S2 | ✖ | Grant reviewers & data-residency claims; DO branch exists but not primary | Publish honest data-residency statement; offer in-country/DO option | Must (document) |
| GAP-29 | Room-type-level booking absent (room fixed at creation) — deliberate; unratified trade-off | Product | S3 | by design | Peak-season selling flexibility vs simplicity | Stakeholder decision Q-OPS-05 | Decision |
| GAP-30 | No staging/UAT environment or seeded demo tenant mentioned for client trials | Delivery | S3 | ✖ | Pilots will demo on production or nothing | Demo-tenant seed + staging per release | Should |

## Priority clusters
- **Production-safety cluster (do first):** GAP-1, 5, 17 (operability) + GAP-7, 8 (legal) + GAP-2 (correctness of the core promise).
- **Scale cluster (before client #10):** GAP-10, 18, 27, 28, 12.
- **Money cluster (before gateway/GST go-live):** GAP-9, 11, 13.
- **Experience cluster:** GAP-3, 14, 16, 4, 24.

## What is *not* a gap (explicitly)
Rates-push to OTAs (impossible for single properties — permanent constraint, correctly refused); live cab dispatch (owned by ROOT sidecar); channel-manager replacement claims (product is honest about the residual window). The prototype's honesty about its own limits is a strength to preserve.
