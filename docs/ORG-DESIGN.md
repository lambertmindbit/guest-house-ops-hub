# Organization Layer & RBAC v2 — Design

**Status:** approved design, not yet implemented
**Date:** 2026-07-04
**Decisions locked:** gap analysis on top of shipped Phase-2 tenancy · Organization layer now · roles `owner/manager/staff` with field-level masking · keep the custom HMAC-cookie auth (add invites + password reset)

---

## 0. Baseline — what already exists (not redesigned here)

Phase 2 shipped per-property multi-tenancy; this design **adds an organization/authorization layer on top of the property layer** and closes three specific leak classes. Already in production:

- Per-property tenancy via a Prisma client extension that auto-injects `propertyId` on ~40 models (`TENANT_MODELS` in `src/lib/prisma.ts`).
- Spoof-proof `x-ota-tenant` header stamped by Edge middleware from the HMAC-verified session (`set()` overwrites any client value).
- `prismaForTenant(id)` factory; sanctioned `unscopedPrisma` for the community seam and cron.
- `User` table with hashed passwords (env vars only seed the first owner); roles `owner/reception/housekeeping`; page-level money gating (`OWNER_ONLY_PREFIXES` in `src/lib/authz.ts`).
- Property switcher (`UserProperty` grants + `/api/session/property`).
- Cross-tenant community seam (Phase 3): default-deny, connection + grant gated.

**Honest framing:** the app is already multi-tenant per property. What is missing is the org layer, a role/masking upgrade, and DB-level hardening — the design is much smaller because of it.

### What does NOT exist (the gap this design covers)

1. **Organization layer** — no `Organization`/`Membership`; users link directly to properties. No billing identity, no "org owns N properties" grouping.
2. **Role taxonomy mismatch** — target is `owner/manager/staff`; repo has `owner/reception/housekeeping`. Enforcement is page/route-level, not field-level (a staff-visible API response can still carry `grossAmount`).
3. **Postgres RLS** — none; isolation is app-layer only.
4. **Invites & password reset** — owner creates users with a password by hand.
5. `User.propertyId` / `UserProperty` — subsumed by the org model; to be deprecated.

---

## 1. Tenancy model — decision

**Keep the single shared DB with app-level scoping as primary enforcement. Do not move to RLS-as-primary. Reject schema-per-tenant outright.**

- **Schema-per-tenant is disqualified** by our own constraints: migration fan-out breaks the additive `db:migrate:new` discipline (every migration × N schemas), the Supabase transaction pooler's connection budget punishes per-schema search-path juggling, and the community network's cross-tenant queries become federated nightmares.
- **RLS-as-primary is disqualified by the stack:** Prisma connects through the transaction pooler as a table-owning role, which **bypasses RLS**. Making RLS bind requires a dedicated non-owner DB role plus `SET LOCAL app.tenant_id` inside a transaction wrapping every query. Viable as a backstop (§8), a bad primary layer — a forgotten `SET LOCAL` fails *closed* into empty results, silently corrupting derived availability instead of erroring.
- **The decisive architectural point: tenancy stays keyed on `property_id`, not `org_id`.** Every operational row already carries `propertyId`; property→org is one hop. The org layer adds **zero columns to the ~40 operational tables** and never touches the correctness core. Org-level scoping is resolved at the session/authz layer ("which properties may this user act in"), not at the row layer.

---

## 2. Data model

New tables (all additive):

```
organizations    id, name, created_at                      -- billing identity later
memberships      id, user_id, org_id, role(owner|manager|staff),
                 created_at, UNIQUE(user_id, org_id)
invites          id, org_id, email, role, token_hash, expires_at, accepted_at
password_resets  id, user_id, token_hash, expires_at, used_at
```

Changes to existing tables:

- `property_settings` + `org_id` (nullable — additive discipline; code treats it as required after backfill). **Properties belong to an org**; "create property" becomes an org-owner action.
- `users.property_id` and `user_properties` are **deprecated, not dropped** — membership + org→properties replaces them. Drop in a cleanup migration months later.

Scoping assignment:

| Scope | Tables |
|---|---|
| **Org-scoped** | memberships, invites, billing (future). Nothing else. |
| **Property-scoped (unchanged)** | everything operational — rooms, reservations, guests, blocks, payments, expenses, housekeeping, staff, inventory, vendors, tours, partners, referrals, trips, messages, pricing, feeds |
| **Deliberate deferral** | cross-property guest CRM would make `guests` org-scoped; it changes guest-dedup semantics and ID-retention/purge logic. Future migration, not now. |
| **Community graph** | stays property-keyed (a peer is a property, not an org) — reputation/referrals are per-location. |

---

## 3. Query-scoping strategy — what changes, what gets hardened

The per-request mechanism survives intact; the *authorization* in front of it changes:

- **Session claims v2:** `{ userId, orgId, role, activePropertyId, v: 2 }`. On property switch, the server validates `activePropertyId ∈ properties(orgId)`. Middleware keeps stamping `x-ota-tenant` from the verified cookie.
- **Server Components:** unchanged — the extension reads the header via `next/headers`.
- **Machine seams:** unchanged and explicitly *not* org-aware — iCal token→property, ingest inbox→property, agent/cron tokens→property (cron iterates properties via `unscopedPrisma` in an explicit loop). Tokens bind to a property; they never consult org membership. Keep it that way.

### Three real holes in the current strategy (the adversarial part)

1. **Raw SQL is invisible to the extension.** The derived-availability query (and any dashboard raw SQL) must carry `WHERE property_id = $1` manually, forever. Mitigations: (a) a single `availabilityFor(propertyId, …)` entry point — no inline raw SQL elsewhere; (b) the RLS backstop (§8) is the only mechanism that can catch a forgotten raw-SQL filter.
2. **`unscopedPrisma` misuse.** Today it is convention-guarded. Make it mechanical: an ESLint `no-restricted-imports` rule so only `src/lib/community/*` (+ cron) may import it.
3. **Cross-tenant `connect` — the sneakiest vector.** The extension injects `where` filters but does not validate *relation targets*: a write could attach a reservation to a `room_id` belonging to another property. The GiST constraint will not save us — it is per-room and would happily "correctly" exclude overlaps in someone else's room. Fix at the DB (§4).

---

## 4. The correctness core under tenancy

- **The GiST exclusion constraint is already tenant-correct as-is.** It is keyed per `room_id`; a room belongs to exactly one property; per-room exclusion never spans tenants. **Do not touch it.**
- Reservations **already have** `property_id` (Phase 2), coexisting fine with the generated daterange column — a plain column, not part of the constraint or the generated expression.
- **Hardening (new): composite FK to kill cross-tenant connect.**

```sql
CREATE UNIQUE INDEX CONCURRENTLY rooms_id_property_uq ON rooms (id, property_id);

ALTER TABLE reservations ADD CONSTRAINT reservations_room_same_property_fk
  FOREIGN KEY (room_id, property_id) REFERENCES rooms (id, property_id) NOT VALID;
ALTER TABLE reservations VALIDATE CONSTRAINT reservations_room_same_property_fk;
-- same pattern for blocks
```

A reservation's `property_id` must now equal its room's — enforced by Postgres, unscoped-client-proof.

> **⚠ Migration ordering risk — loudly:** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction, and Prisma wraps migrations in one. This must go through the `db:migrate:new` raw-SQL path as a **non-transactional, standalone migration**, in its own deploy, **never** in the same file as anything touching the generated column or the GiST constraint. `NOT VALID` + `VALIDATE` keeps the lock window at zero-downtime.

---

## 5. Auth stack (keep custom — the delta)

- **Sessions:** add a claim version. v1 cookies (no `orgId`) are rejected by middleware → forced re-login. At current user counts, a clean cut beats dual-format code.
- **Invites:** owner/manager creates invite (email + role) → single-use token (store only its hash), 7-day expiry → link → set password → `User` + `Membership` created atomically. Replaces "owner types a password for the user".
- **Password reset:** same token pattern, 1-hour expiry, invalidated on use, rate-limited by email+IP.
- **Outbound email:** both flows reuse the existing messaging adapter seam (`LogAdapter` in dev).
- **Env-var seeding** (`OWNER_EMAIL/OWNER_PASSWORD` first-login bootstrap) survives but now creates Org #1 + owner membership. It is the self-hosting story; keep it.

---

## 6. Roles & permissions

**Enum migration:** `ALTER TYPE ... ADD VALUE` is additive — add `manager`, `staff`; backfill `reception→staff`, `housekeeping→staff`; old values stay in the enum, unused (harmless). If the housekeeping-vs-frontdesk distinction matters later, that is a `department` field, orthogonal to authorization.

**Capability matrix (single source of truth, `authz.ts`):**

| Capability | owner | manager | staff |
|---|:--:|:--:|:--:|
| bookings / calendar / guests / housekeeping ops | ✓ | ✓ | ✓ |
| see money (rates, gross, balances, finance, pricing, expenses) | ✓ | ✓ | ✗ |
| report scam-number / guest-flag | ✓ | ✓ | ✗ |
| *see* scam/guest alerts at check-in | ✓ | ✓ | ✓ |
| manage users, invites, property settings | ✓ | ✓ | ✗ |
| org: billing, create/delete property, delete org data | ✓ | ✗ | ✗ |

One function — `can(viewer, capability)` — consulted by route guards, presenters, and UI. `OWNER_ONLY_PREFIXES` becomes capability-driven instead of a path list.

**Field-level masking — the choke point is a presenter layer, not scattered checks:**

- Lib stays honest (returns full rows). Every boundary crossing — API response *and* Server Component → client props — passes through `presentX(row, viewer)`, returning `ReservationView | ReservationStaffView` where the staff type **structurally lacks** `grossAmount`, payment fields, rate fields. TypeScript then makes "staff UI renders money" a compile error, and money never reaches a staff client at all (not CSS-hidden).
- Consistency is enforced by a **contract test**: log in as staff, walk every GET route + rendered page props, assert a per-entity denylist of finance keys never appears in any payload. That test prevents ad-hoc-check drift.

---

## 7. Migration / rollout plan (each step deployable, no downtime)

1. **Migration A** (additive): `organizations`, `memberships`, `invites`, `password_resets`, enum values, `property_settings.org_id NULL`. No code reads them. Deploy.
2. **Backfill** (idempotent script, like the seed): Org "Default" ← existing property; owner user → owner membership; reception/housekeeping users → staff memberships; set `org_id`. Verify, re-runnable.
3. **Code deploy — session v2 + org-aware switcher.** Code tolerates `org_id NULL` (falls back to sole-property behaviour) until the backfill is verified, then a startup guard flips to requiring it. This tolerance window prevents the broken half-migrated state.
4. **Migration B** (standalone, non-transactional): composite FKs (§4).
5. **Presenters + masking + contract tests** (pure code).
6. **Invites + reset flows** (uses tables from step 1).
7. **RLS backstop last** (§8) — optional, independently shippable.

---

## 8. Risks & testing

**Top leak vectors, ranked:**

1. Unscoped raw SQL (the extension cannot see it)
2. `unscopedPrisma` outside the community seam
3. Cross-tenant `connect` (reservation → foreign room)
4. Property switcher accepting a non-member property
5. Machine-token / property confusion
6. Community projections over-sharing

**"Forgot to scope" failure mode:** the extension already makes the Prisma path safe-by-default — residual risk is exactly #1 and #3, which is why the composite FK (mechanical) and the raw-SQL single-entry-point rule exist.

**RLS as belt-and-suspenders: yes, but scoped and last.** Policies on the PII/money tables only (`guests`, `reservations`, `payments`, `outbound_messages`), a dedicated non-`BYPASSRLS` app role, and the tenant extension issuing `SET LOCAL app.tenant_id` in a wrapping transaction (works under the transaction pooler; batch overhead is acceptable at current QPS). Community/cron keep a separate policy-exempt role. If pooler friction bites, RLS on just those four tables still catches the worst-case leak (guest PII, money). It is a backstop — if it ever *changes* a result, that is a bug alarm, not a feature.

**Testing:**

- Extend the existing two-property isolation tests to **two orgs**.
- Multi-tenant variants of the conflict/availability suite: same dates in different properties must never conflict; a reservation `connect`ed to a foreign room must be rejected by the composite FK.
- Staff masking contract test (§6).
- Switcher rejection test: member of org A requests property of org B → 403.
- RLS smoke test: wrong GUC → 0 rows (not someone else's rows).

---

## 9. Sacred-core pressure points (stated loudly)

Nothing here modifies the GiST constraint, the generated daterange column, or derived availability. The only migration that goes near `reservations` is the composite FK, and it must ship **alone, non-transactionally, via `db:migrate:new`**.

---

## 10. PR slicing (implementation plan)

| PR | Contents | Depends on |
|---|---|---|
| 1 | Migration A: org/membership/invite/reset tables + enum values + `property_settings.org_id` (additive, unread) | — |
| 2 | Backfill script (idempotent) + run against prod; verification query | 1 |
| 3 | Session v2 (orgId claims, version bump), org-aware property switcher, login builds v2, middleware rejects v1 | 2 |
| 4 | Migration B: composite FKs (rooms unique index CONCURRENTLY + reservations/blocks FKs) — standalone, non-transactional | 3 |
| 5 | `can()` capability map; role remap (reception/housekeeping→staff); presenter layer + staff masking; contract test | 3 |
| 6 | Invites + password reset flows (API + UI + email via messaging adapter) | 3 |
| 7 *(optional)* | RLS backstop: non-bypass DB role, policies on 4 PII/money tables, `SET LOCAL` in tenant extension; smoke tests | 4 |

Each PR is CI-gated and independently deployable; the tolerance window in PR 3 (code accepts `org_id NULL`) is removed in PR 5 once the backfill is verified in prod.
