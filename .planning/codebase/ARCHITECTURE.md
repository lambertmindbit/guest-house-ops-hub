<!-- refreshed: 2026-06-01 -->
# Architecture

**Analysis Date:** 2026-06-01

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Browser (mobile-first PWA)                │
│   Server Components (pages) + a few "use client" widgets     │
│   `src/app/*/page.tsx`        `src/components/*.tsx`         │
└───────┬─────────────────────────────────────┬───────────────┘
        │ fetch() from client widgets          │ direct call (RSC)
        ▼                                       ▼
┌─────────────────────────┐         ┌───────────────────────────┐
│  API Route Handlers     │         │  Domain logic (lib)        │
│  `src/app/api/**/route.ts`◄───────┤  `src/lib/*.ts`            │
│  Zod validate → call lib│  call   │  availability, calendar,   │
│  → { data } / { error } │ ───────►│  dashboard, conflicts,     │
└───────────┬─────────────┘         │  finance, analytics,       │
            │                       │  reservations, housekeeping│
            │                       │  ical / ical-import        │
            ▼                       └─────────────┬─────────────┘
┌─────────────────────────────────────────────────┼─────────────┐
│  Prisma Client singleton  `src/lib/prisma.ts`    │             │
│  typed queries + `$queryRaw` for derived counts ◄┘             │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL                                                  │
│  Generated half-open DATERANGE columns (`stay`, `period`)   │
│  + GiST EXCLUDE constraint `no_overlapping_confirmed_stays` │
│  `prisma/migrations/20260601114302_init/migration.sql`      │
└─────────────────────────────────────────────────────────────┘

  Edge middleware `src/middleware.ts` gates every non-public route on the
  signed session cookie before any of the above runs.
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Edge middleware | Redirect unauthenticated requests to `/login` (gates all but public routes) | `src/middleware.ts` |
| Auth primitives | HMAC-sign/verify session token, verify owner credentials (Web Crypto, Edge+Node safe) | `src/lib/auth.ts` |
| Prisma singleton | One `PrismaClient` reused across hot-reloads | `src/lib/prisma.ts` |
| API envelope | `ok()`/`fail()`/`zodFail()` → consistent `{ data }`/`{ error }` | `src/lib/api.ts` |
| Reservation writes | Wrap create/update, translate overlap violation into `OverlapError` | `src/lib/reservations.ts` |
| Overlap detection | Sniff Postgres `23P01` / constraint name off raw error | `src/lib/db-errors.ts` |
| Availability | DERIVED per-night counts via raw SQL (rooms − reservations − blocks) | `src/lib/availability.ts` |
| Calendar | Build rooms × dates grid, flag occupied/blocked/conflict | `src/lib/calendar.ts` |
| Dashboard | Today's check-ins/outs, in-house, next-7, occupancy % | `src/lib/dashboard.ts` |
| Conflicts | Find reservation∩block overlaps via daterange `&&`/`*` | `src/lib/conflicts.ts` |
| Housekeeping | Rooms needing cleaning since last checkout | `src/lib/housekeeping.ts` |
| Finance | Per-channel gross/commission/net/collected/outstanding | `src/lib/finance.ts` |
| Analytics | Occupancy, ADR, RevPAR, source mix | `src/lib/analytics.ts` |
| iCal export | Build anonymised `.ics` busy feed (no dependency) | `src/lib/ical.ts` |
| iCal import | Fetch feeds via `node-ical`, mirror busy events into `ical` blocks | `src/lib/ical-import.ts` |
| Dates | Date-only parse/format/add, anchored to UTC midnight | `src/lib/dates.ts` |
| Format | Display helpers (dates, INR money, payment labels) | `src/lib/format.ts` |

## Pattern Overview

**Overall:** Next.js 15 App Router monolith — a layered server app where UI, API, and domain logic live in one codebase. Three-layer separation: presentation (App Router pages/components) → application (API route handlers + `src/lib` domain functions) → persistence (Prisma + Postgres). The database is treated as an active participant in correctness, not a dumb store.

**Key Characteristics:**
- **Derived state, never stored counters.** Availability/occupancy is computed live from confirmed reservations + blocks every read. No mutable "free rooms" number exists anywhere.
- **Correctness pushed into the database.** The no-double-booking guarantee is a Postgres GiST `EXCLUDE` constraint on a generated `stay` DATERANGE, not app code. App code only translates the resulting error into a friendly message.
- **Thin route handlers, logic in `src/lib`.** Route files validate input (Zod) and shape the response envelope; the actual querying/calculation lives in reusable `src/lib/*` functions shared by both Server Components and API routes.
- **Half-open date ranges everywhere.** `[check-in, check-out)` so a checkout day is free for a same-day arrival, consistently in SQL, iCal export, and client-side comparisons.

## Layers

**Presentation (App Router):**
- Purpose: Render mobile-first screens; mostly async Server Components that call `src/lib` directly.
- Location: `src/app/*/page.tsx`, `src/components/*.tsx`
- Contains: Page components, a `NavBar`, and interactive client widgets (`"use client"`: `ReservationForm`, `PaymentsPanel`, `ImportFeeds`, `CleaningButton`, `CancelReservationButton`, `CopyButton`).
- Depends on: `src/lib` domain functions (server components), `/api/*` routes (client widgets via `fetch`).
- Used by: The browser.

**Application — API route handlers:**
- Purpose: HTTP boundary for client-side mutations/queries and machine consumers (cron, OTAs).
- Location: `src/app/api/**/route.ts`
- Contains: Zod schemas (co-located), guest upsert, response envelope shaping, error→status mapping.
- Depends on: `src/lib` domain functions, `src/lib/api`, `src/lib/dates`.
- Used by: Client components, Vercel Cron (`/api/cron/sync`), external OTAs (`/api/ical/...`).

**Application — domain logic (`src/lib`):**
- Purpose: All querying, derivation, and business calculation. The reusable core.
- Location: `src/lib/*.ts`
- Contains: Prisma queries, raw SQL for derived availability/conflicts, money/occupancy math, iCal build/parse.
- Depends on: `src/lib/prisma`.
- Used by: Server Components and API route handlers (single source of truth shared by both).

**Persistence:**
- Purpose: Store entities and enforce the no-overlap invariant.
- Location: `prisma/schema.prisma`, `prisma/migrations/`
- Contains: Tables, generated DATERANGE columns, GiST exclusion constraint, indexes.
- Depends on: PostgreSQL with `btree_gist`.
- Used by: The Prisma singleton.

## Data Flow

### Primary Request Path — create a reservation

1. Client submits `ReservationForm` → `POST /api/reservations` (`src/components/ReservationForm.tsx`)
2. Handler parses body with Zod `createSchema`, rejecting bad input via `zodFail` (`src/app/api/reservations/route.ts:42`)
3. Guest resolved: upsert by unique phone so repeat guests stay one record (`src/app/api/reservations/route.ts:51`)
4. `createReservation(...)` inserts the row (`src/lib/reservations.ts:14`)
5. Postgres evaluates the GiST `EXCLUDE` constraint; an overlap raises SQLSTATE `23P01`
6. `isOverlapError` detects it (`src/lib/db-errors.ts:7`); `createReservation` throws `OverlapError`
7. Handler maps `OverlapError` → `fail(message, 409)` (`src/app/api/reservations/route.ts:78`); otherwise returns `ok(full, 201)`

### Read path — Today dashboard (Server Component)

1. `DashboardPage` (RSC) runs `getTodaySummary`, `getConflicts`, `getHousekeeping` in parallel (`src/app/page.tsx:13`)
2. `getTodaySummary` issues parallel Prisma queries for check-ins/outs/in-house/next-7 and derives occupancy % (`src/lib/dashboard.ts:20`)
3. HTML streamed to the phone; `export const dynamic = "force-dynamic"` disables caching (`src/app/page.tsx:10`)

### Availability query (derived, never stored)

1. Caller hits `GET /api/availability` or `getAvailability(...)` (`src/lib/availability.ts:16`)
2. Raw SQL builds a `nights` series and, per night, subtracts `count(DISTINCT room_id)` of confirmed reservations ∪ blocks (via daterange `@>`) from total rooms (`src/lib/availability.ts:21`)
3. Returns one `{ date, total, available }` row per night.

### iCal import (ingestion) — cron-driven

1. Vercel Cron calls `GET /api/cron/sync` with `Authorization: Bearer <CRON_SECRET>` (`src/app/api/cron/sync/route.ts:6`)
2. `syncAllFeeds` iterates active feeds; `syncFeed` fetches+parses each via `node-ical` (`src/lib/ical-import.ts:26`)
3. Per feed: delete-then-insert its `ical` blocks inside a transaction (idempotent + self-healing); manual blocks and other feeds untouched (`src/lib/ical-import.ts:43`)
4. Feed's `lastSyncedAt`/`lastError` updated.

### iCal export (push) — public, token-gated

1. OTA fetches `GET /api/ical/[token]/[room].ics` (no session cookie) (`src/app/api/ical/[token]/[room]/route.ts:18`)
2. Token compared in constant time; mismatch → 404 (`src/app/api/ical/[token]/[room]/route.ts:8`)
3. Current/future confirmed reservations + blocks rendered as anonymised all-day VEVENTs ("Reserved"/"Blocked") via `buildIcsFeed` (`src/lib/ical.ts:43`)

**State Management:**
- Server-side state is the database; availability/occupancy are derived on every read.
- No client-side global store. Client widgets hold local form state and call `router.refresh()` after mutations to re-pull server data.
- Session state is a signed httpOnly cookie (`ota_session`), verified at the edge.

## Key Abstractions

**DATERANGE stay/period (the correctness core):**
- Purpose: Represent a half-open `[start, end)` occupancy interval the DB can reason about.
- Examples: `prisma/schema.prisma:100` (`stay`), `prisma/schema.prisma:139` (`period`)
- Pattern: Postgres GENERATED columns from the `DATE` pair; declared `Unsupported("daterange")?` in Prisma so it tracks but never writes them. The GiST `EXCLUDE` and overlap queries operate on these.

**Response envelope:**
- Purpose: One predictable shape for every API response.
- Examples: `src/lib/api.ts`
- Pattern: success → `{ data }`, failure → `{ error }`; `zodFail` formats validation errors as a single friendly string (422).

**OverlapError → 409:**
- Purpose: Turn a low-level DB constraint violation into a domain-meaningful, user-friendly result.
- Examples: `src/lib/reservations.ts:7`, `src/lib/db-errors.ts`
- Pattern: catch raw error in the write helper, re-throw a typed `OverlapError`, map to `409` at the route boundary.

**Domain function shared by RSC + API:**
- Purpose: Avoid duplicating query/derivation logic between page and endpoint.
- Examples: `getTodaySummary` used by `src/app/page.tsx` and `src/app/api/dashboard/today/route.ts`.
- Pattern: pure-ish async function in `src/lib` that takes primitives and returns plain objects.

## Entry Points

**HTTP middleware:**
- Location: `src/middleware.ts`
- Triggers: Every request matching the matcher (everything except `/login`, `/api/auth`, `/api/ical`, `/api/cron`, Next internals, PWA/static assets).
- Responsibilities: Verify session cookie; redirect to `/login` if absent/invalid.

**Root layout + pages:**
- Location: `src/app/layout.tsx`, `src/app/page.tsx`
- Triggers: Browser navigation.
- Responsibilities: PWA metadata/viewport, render `NavBar` + page; pages fetch their own data as Server Components.

**API route handlers:**
- Location: `src/app/api/**/route.ts`
- Triggers: `fetch` from client widgets; Vercel Cron; external OTA iCal fetchers.
- Responsibilities: Validate, call domain logic, shape `{ data }`/`{ error }`.

**Seed:**
- Location: `prisma/seed.mjs` (run via `npm run db:seed`)
- Triggers: Manual / setup.
- Responsibilities: Load sample room-types, rooms, and the five channels.

## Architectural Constraints

- **Threading:** Single-threaded async (Node/Edge event loop). Heavy reads are parallelised with `Promise.all`, not threads.
- **Runtime split:** Auth crypto uses Web Crypto (`crypto.subtle`) specifically so the SAME `src/lib/auth.ts` runs in the Edge middleware AND Node route handlers. Do not introduce Node-only crypto there.
- **Global state:** Only the Prisma client is a module-level singleton (`src/lib/prisma.ts`), guarded for dev hot-reload. No other shared mutable state.
- **`node-ical` bundling:** It is a CJS package excluded from bundling via `serverExternalPackages` in `next.config.mjs`; it must only be imported in server code.
- **Generated columns are read-only to the app:** `stay`/`period` are derived by Postgres. App code never writes them and must not be "fixed" into normal Prisma fields.
- **Public routes bypass the cookie:** `/api/ical/*` (token-gated) and `/api/cron/sync` (`CRON_SECRET` bearer) authenticate themselves and are deliberately excluded from the middleware matcher.

## Anti-Patterns

### Treating availability as a stored counter

**What happens:** A developer adds a `free_rooms`/`available` column and increments/decrements it on booking.
**Why it's wrong:** It drifts out of sync with reservations + blocks and silently corrupts the calendar; it also duplicates a value Postgres can derive exactly.
**Do this instead:** Derive it live. Follow the raw-SQL pattern in `src/lib/availability.ts` (rooms − confirmed reservations − blocks via daterange `@>`).

### Weakening the exclusion constraint to make a feature "work"

**What happens:** A write fails the `no_overlapping_confirmed_stays` constraint and someone relaxes or drops it.
**Why it's wrong:** The constraint is the single source of booking correctness; a failure means the feature has a bug, not the constraint.
**Do this instead:** Catch `23P01` via `isOverlapError` (`src/lib/db-errors.ts`) and surface a friendly 409 (`src/lib/reservations.ts`, `src/app/api/reservations/route.ts`).

### Inclusive end dates / ad-hoc date math

**What happens:** Code compares dates with `<=` on the checkout day or builds `Date`s with local time, shifting across the day boundary.
**Why it's wrong:** Breaks the half-open `[in, out)` invariant — a checkout day wrongly reads as occupied, blocking same-day arrivals; timezone drift misreports "today".
**Do this instead:** Use the UTC-midnight helpers in `src/lib/dates.ts` and the half-open comparisons used in `src/lib/calendar.ts`.

## Error Handling

**Strategy:** Validate at the boundary, translate known failures to friendly messages, let unknown errors throw.

**Patterns:**
- Zod `safeParse` on every API input; failures → `zodFail` (422) with one human message (`src/lib/api.ts`).
- DB overlap violation → typed `OverlapError` → `fail(message, 409)` (never a raw 500).
- Public/machine routes return plain `Response` with explicit status (404 on bad iCal token, 401 on bad cron secret).
- iCal import never throws to the cron caller — per-feed errors are captured into `lastError` and returned in the result.

## Cross-Cutting Concerns

**Logging:** None beyond default Next.js/Vercel request logs; feed sync errors are persisted to `ical_feeds.last_error` rather than logged.
**Validation:** Zod schemas co-located in each `route.ts`; shared `dateOnly` validator in `src/lib/dates.ts`.
**Authentication:** Single-owner signed-cookie session verified at the Edge (`src/middleware.ts` + `src/lib/auth.ts`); machine routes self-authenticate (iCal token, `CRON_SECRET`).

---

*Architecture analysis: 2026-06-01*
