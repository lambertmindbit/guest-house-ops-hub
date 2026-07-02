# Lawei Gap Analysis — Phase 3 Status

_"Regional community network" (the client's "Rapido for homestays" vision) — what
shipped vs. what's deferred, against `ROOT_Lawei_Gap_Analysis` (MindBit).
Prepared 2026-07-02._

Phase 3 was built as **nine single-purpose PRs** (#56–#64), each additive and
CI-verified against a real Postgres. It is inherently **cross-tenant** and builds
on the Phase 2 multi-tenancy + RBAC foundation. The correctness core is untouched:
the `no_overlapping_confirmed_stays` GiST constraint was verified intact after
every migration, and availability stays derived.

## The central design: the community seam

Phase 2's auto-scoping Prisma client **forbids** cross-tenant reads. Phase 3 does
not weaken it. Instead, **all** cross-tenant access goes through `src/lib/community/*`,
which only ever reads a peer's data via the **unscoped client** (`unscopedPrisma`),
**after** an accepted `NetworkConnection` + an enabled `SharingGrant` are checked
(default-deny), returning a **hard-whitelisted public projection** — never guest
PII, occupancy internals, or finance — and audit-logging the access.

Per-request tenant binding was also activated here: the edge middleware stamps a
tamper-proof `x-ota-tenant` header from the verified session, which the tenant
extension reads. This keeps Phase 2 isolation correct once more than one property
exists (previously ≥2 properties fell back to an unscoped passthrough).

## Slices

| Slice | PR | What |
|---|----|------|
| a — Trusted-network foundation | #56 | Per-request tenancy; `NetworkConnection` + per-peer, per-type `SharingGrant`; the pure `canRead` guard; Settings › Trusted network. **Nothing is shared unless opted in.** |
| b — Searchable directory | #57 | Read-only discovery over `isDiscoverable` peers, filtered by amenity/need + price band. Contact phone shown only after connecting. |
| c — Shared availability board | #58 | Opt-in, `AVAILABILITY`-gated, **derived** peer availability (counts only — no guest/finance). A peek on connected directory entries. |
| d — Overflow referral marketplace | #59 | The headline feature: refer → accept → book **through the guarded path** (409 inherited) → attribute revenue → **derived** reciprocal credit ledger → analytics. Guest phone withheld until accepted. |
| e — Community scam network | #60 | Opt-in verified shared scam list on top of the private `FlaggedNumber` list. Hashed phone, evidence-to-verify, `SCAM` grant, retention, dispute/appeal, audit, CSV export. |
| f — Bad-guest alerts | #61 | Evidence-backed shared alerts on the `Guest` blacklist. Hashed phone + masked first name, categorised evidence, `BAD_GUEST` grant, same safeguards. |
| g — No-show reliability → shared flag | #62 | A **derived** per-guest reliability score; a conservative threshold (≥3 bookings, ≥2 no-shows, ≥40%) gates an owner-filed shared repeat-offender flag (reuses the bad-guest workflow; server-recomputed, appealable). |
| h — Shared trusted directories | #63 | Read-only sharing of vendor + driver contacts via the `VENDORS` / `TRANSPORT` grants — public fields only (no notes/POs/payments/trips/fares). Guides + emergency contacts are vendor categories. |
| i — Rollout polish | #64 | Multi-location property switcher (`UserProperty`, re-issues the session; audit-logged) + hand-written, dependency-free offline tolerance (conservative SW: network-first pages, offline fallback, no stale data, no offline writes) + an offline banner. |

## Safeguards on the sensitive slices (e, f, g)

Per the maintainer's steer that the decision to share is the owner's discretion,
the blocking legal-review gate was dropped — but the technical safeguards ship as
sensible defaults: **data minimisation** (share a hashed signal + last 4 / first
name, never raw PII), **evidence required to verify**, **moderation** (only
verified + unexpired share), **retention** (auto-expiry), a **dispute/appeal**
path, **grant-gated** sharing (default-deny), and **audit** on report / verify /
dispute / view / export.

## Deferred / out of scope (flagged, not built)

| Area | Why |
|---|-----|
| **Real WhatsApp/BSP send + the conversational LLM agent** | Live in the separate **ROOT** service. This repo provides the data, contracts, and safeguards; ROOT orchestrates + notifies across the community via the existing agent seam. |
| **Real OTA push/pull channel-manager APIs** | Not available to a single property (unchanged project constraint). |
| **Offline write queue** | Deliberately omitted — a booking created offline can't be conflict-checked against the GiST constraint. Offline is read-tolerant only. |

## Notes / small follow-ups (non-blocking)

- **Per-membership roles.** The property switcher keeps the user's role across
  properties; a full model would store a role per `UserProperty`.
- **Token-gated public routes** (`/api/agent`, `/api/ingest`, `/api/ical`,
  `/api/cron`) don't receive the `x-ota-tenant` header (they bypass middleware);
  in a true multi-property deployment they need explicit `propertyRef` targeting
  (already noted in the ROOT agent seam).
- **Amenity matching** in the directory is by normalized name substring; a shared
  amenity vocabulary would tighten it.
- **Evidence attachments** for scam/bad-guest reports are text notes today; the
  existing Supabase Storage seam can back real photo/document uploads later.

See [PHASE-1-GAP-STATUS.md](PHASE-1-GAP-STATUS.md) and
[PHASE-2-STATUS.md](PHASE-2-STATUS.md) for the earlier phases.
