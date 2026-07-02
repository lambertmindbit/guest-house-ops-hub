# Lawei Gap Analysis — Phase 2 Status

_"Complete the PMS & team" — what shipped vs. what's deferred, against
`ROOT_Lawei_Gap_Analysis` (MindBit). Prepared 2026-07-02._

Phase 2 was built as **twelve single-purpose PRs** (#42–#54), plus one infrastructure
fix (#46), each additive and CI-verified against a real Postgres. It **starts the
multi-tenancy + auth epic** the earlier handoff had deferred, then layers the team /
operations modules on top. The correctness core is untouched: the
`no_overlapping_confirmed_stays` GiST constraint and the derived-availability rule
still hold (verified by CI on every slice).

## Foundational (gating) slices

| Slice | PR | What |
|---|----|------|
| a — Multi-tenancy foundation | #42 | `property_id` on 22 tables (backfilled to the sole property); a Prisma client extension auto-scopes every read/write; `prismaForTenant(id)` for explicit per-tenant work; a tenant-isolation test proves A never sees B. **Operates one property today, correct for N.** |
| b — Real auth + RBAC | #43 | `User` + roles (owner / reception / housekeeping); passwords via Node **scrypt** (no dep); **signed role+property claims** in the session token, so the edge middleware enforces access with no DB lookup. **"Money only for owners"** — reception/housekeeping blocked from finance/analytics/pricing/settings; housekeeping limited to Today + Cleaning. Owner seeded from `OWNER_EMAIL/PASSWORD` on first login. |

## Team & operations modules

| Slice | PR | What |
|---|----|------|
| c — Staff | #44 | Directory + shift roster + attendance (present/absent/leave). |
| d — Housekeeping assignment | #45 | Assign cleaning to a named staff member + per-room checklist + completion accountability, layered over the derived needs-cleaning flow. |
| e — Maintenance | #47 | Repair requests (assignee/vendor/cost/status) + asset register + preventive "service due". |
| f — Inventory | #48 | Items, stock In/Out movements, low-stock alerts, consumption. |
| g — Vendors & procurement | #49 | Directory + purchase orders (draft→ordered→received) + payments + procurement summary. |
| h — Transport | #50 | Driver + trip **records** for history & fares. **No dispatch** — that stays in the ROOT CabAgent. |
| i — Group / long-stay bookings | #51 | A folio wrapper linking several room bookings. Children are created the normal (guarded) way and only **linked**, so the 409 no-double-booking guarantee is untouched. |
| j — Amenities | #52 | Property amenity catalog + per-room-type coverage. Seeds the Phase-3 searchable directory. |
| k — Reviews | #53 | Request tracker + status + response drafting (ROOT sends; the OTA tracks). |
| l — Audit + consent | #54 | Audit log of sensitive actions (cancel / refund / blacklist / user & consent changes) + guest privacy-consent capture. |

## Infrastructure fix (root cause of the drift)

| PR | What |
|----|------|
| #46 | **Migrations now apply on production deploys.** The build was `prisma generate && next build` — no migrate step — so merges never applied migrations and the DB fell behind. `vercel.json` now runs `scripts/vercel-build.sh`, which runs `prisma migrate deploy` on **production** deploys only (preview deploys skip it; local `npm run build` is unchanged). Requires `DIRECT_URL` in the Vercel Production env. |

## Deferred (flagged, not started)

| Area | Why | Gap ref |
|---|-----|---------|
| **Community network** — overflow referrals, shared availability, searchable directory, shared scam/bad-guest, no-show scoring | Phase 3; builds on the multi-tenancy foundation laid here. | OV-1/2, PT-1/2, SC-2, BG-1, CY-1, NS-1 |
| **Real WhatsApp/BSP send + conversational LLM agent** | Stay in **ROOT**, not this repo (needs a BSP + the agent service). | GL-1/2, CM-1, IT-1, AI-1 |

## Notes / small follow-ups (within the epic, non-blocking)

- **Per-request tenant binding.** The default `prisma` auto-scopes to the sole property, so the app is correct today. True multi-property operation should bind `prismaForTenant(session.propertyId)` per request (the reliable path) — a small change when multiple properties go live.
- **Per-tenant guest-phone uniqueness** (`@@unique([propertyId, phone])`) — kept global `@unique` for the one-property demo; needed before running multiple real properties.
- **Finer per-action API RBAC** for shared endpoints (e.g. housekeeping can reach `/api/rooms` for mark-clean); the money boundary is enforced, the rest is nav-hidden.
- **Maintenance photos** — the `photo_paths` field ships; the upload UI reuses the existing Supabase Storage seam later.
- **`NOT NULL` tightening** of `property_id` deferred until the backfill is confirmed across environments.

See [PHASE-1-GAP-STATUS.md](PHASE-1-GAP-STATUS.md) for the Phase 1 summary.
