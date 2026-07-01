# Lawei Gap Analysis — Phase 1 Status

_What shipped vs. what's deferred, against `ROOT_Lawei_Gap_Analysis` (MindBit) — prepared 2026-07-01._

Phase 1 was built as **seven single-purpose PRs** (#34–#40), each additive, single-tenant,
and CI-verified against the real Postgres constraints. The correctness core was never
touched: the `no_overlapping_confirmed_stays` GiST constraint and the generated `daterange`
columns are intact, availability/finance stay **derived**, and every new booking-write path
goes through the shared guarded create logic (so it inherits the 409).

## Shipped

| Slice | PR | What | Notable files |
|---|----|------|---------------|
| a — Guest record | #34 | Address, vehicle, emergency contact, preference tags; ID-compliance flags (checked / photocopied / uploaded / verification-completed); **activated** Supabase ID-document upload; printable **registration + Form-C card**. | `lib/registration.ts`, `app/guests/[id]/registration/` |
| b — Cancellation & refunds | #35 | Owner-editable free-cancel windows (normal / **peak** = check-in inside a positively-adjusted season); refund workflow (request → approve / partial / reject). Cancellation stays HITL; **agents never refund**. | `lib/cancellation.ts`, `Refund`/`CancellationPolicy` models |
| c — Complaints | #36 | Log / assign / resolve with resolution note + satisfaction; report (volume by category, avg resolution time). **High-priority auto-files an Escalation** → surfaces on Needs you. | `lib/complaints.ts`, `app/complaints/` |
| d — Messaging trigger | #37 | Booking-confirmation rendered from a pure template and logged through the existing **LogAdapter** on both owner + agent create paths. **No SDK.** | `lib/message-templates.ts`, `messaging.ts` |
| e — UPI link | #38 | Property VPA + a tap-to-pay `upi://pay` link for the outstanding balance. **No SDK / merchant account.** | `lib/upi.ts`, `PaymentsPanel` |
| f — Dashboard & channels | #39 | "Payments pending" card on Today (derived); seeded Instagram, Facebook, Travel agent, Walk-in, Word-of-mouth channels. | `finance.ts` `getPendingPayments`, `prisma/seed.mjs` |
| g — Data migration | #40 | Guided CSV import for guests + bookings with dry-run preview; **every booking row runs through `createReservation()`** so overlaps are rejected per-row (409). | `lib/import.ts`, `app/settings/import/` |

Migrations added (all additive / nullable, forward-compat `property_id`):
`add_guest_profile_fields`, `add_cancellation_and_refunds`, `add_complaints`, `add_upi_vpa`.

## Deferred (flagged, not started)

| Area | Why | Gap ref |
|---|-----|---------|
| **Real WhatsApp/SMS send** | Needs a BSP (approval + per-message cost + lead time). The outbox + trigger seam are ready; wiring a provider into `logMessage()` sends with no caller change. | IT-1, CM-1/3, RS-5 |
| **Conversational AI agent** (after-hours replies — the #1 pain) | Separate **ROOT** service; this repo exposes the guarded `/api/agent/*` seam it consumes. No LLM SDK here. | GL-1/2, CH-2, AI-1 |
| **Razorpay / hosted checkout + QR** | Needs a payment SDK + merchant account. UPI **link** ships now; hosted collection is the flagged next step. | IT-1, PM-1 |
| **Multi-tenancy + real auth/roles (RBAC)** | The gating epic for multiple locations **and** the whole community layer. Single-tenant today; new tables already carry a nullable `property_id`. | ST-1, SE-1, FU-1 |
| **Community network** — overflow referrals, shared availability, searchable directory, shared scam/bad-guest lists, no-show reliability scoring | Inherently cross-property → waits on tenancy. | OV-1/2, PT-1/2, SC-2, BG-1, CY-1 |
| **Other operational modules** — maintenance/assets, inventory, vendors/procurement, transport/trip records, tours, reviews, staff scheduling | Phase 2/3 scope in the gap register; not part of this engagement. | MT-1, IV-1, VN-1, TR-1, TO-1, RV-1, ST-2 |
| **Amenities model, group/long-stay bookings, audit log + consent, offline tolerance, server-side PDF** | Phase 2/3. | BP-3, RS-6, CP-3, SW-1 |

## Notes
- `~55%` of the discovery requirements were already met before this engagement; Phase 1
  closes the highest-priority honest gaps (guest/ID completeness, cancellation/refund engine,
  complaints, messaging groundwork, UPI, onboarding import) — see the gap register for the
  full line-by-line disposition.
- The one thing Phase 1 does **not** close is the owner's ranked #1 pain (after-hours
  replies): that needs the ROOT Assistant **and** a WhatsApp BSP, both deferred above. This
  engagement builds the groundwork they plug into.
