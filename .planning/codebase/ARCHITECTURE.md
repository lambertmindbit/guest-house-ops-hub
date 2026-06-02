<!-- refreshed: 2026-06-02 -->
# Architecture

**Analysis Date:** 2026-06-02

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                   Browser (mobile-first PWA)                 │
│   Server Components render HTML · "use client" islands       │
│   handle interactivity, fetch /api/*, then router.refresh()  │
└───────────────┬─────────────────────────────┬───────────────┘
                │ (navigations + RSC)          │ (fetch JSON)
                ▼                              ▼
┌──────────────────────────────┐  ┌───────────────────────────┐
│   App Router pages           │  │   API route handlers      │
│   `src/app/**/page.tsx`      │  │   `src/app/api/**/route.ts`│
│   (Server Components,        │  │   Zod-validate → call lib  │
│    force-dynamic)            │  │   → {data}/{error} envelope│
└───────────────┬──────────────┘  └─────────────┬─────────────┘
                │                                │
                └──────────────┬─────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Domain layer  `src/lib/*`                    │
│  availability · reservations · calendar · dashboard ·       │
│  conflicts · housekeeping · finance · analytics · pricing · │
│  ical · ical-import · auth · dates · format · csv · db-errors│
└───────────────────────────────┬─────────────────────────────┘
                                │ Prisma Client + raw SQL
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL  (Docker Compose / VPS)              │
│  Generated `daterange` columns + GiST EXCLUDE constraint    │
│  `no_overlapping_confirmed_stays` is the correctness core   │
└─────────────────────────────────────────────────────────────┘

         Edge middleware `src/middleware.ts` wraps EVERYTHING:
         every request must carry a valid HMAC session cookie
         (except /login, /api/auth, /api/ical, /api/cron, statics).
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Edge middleware | Gate all routes behind HMAC session cookie; redirect to /login | `src/middleware.ts` |
| Auth core | Sign/verify session token + credential check (Web Crypto, Edge+Node) | `src/lib/auth.ts` |
| API envelope helpers | `ok`/`fail`/`zodFail` produce the consistent `{data}`/`{error}` shape | `src/lib/api.ts` |
| Prisma singleton | One shared `PrismaClient` reused across hot-reloads | `src/lib/prisma.ts` |
| Availability | Derive nightly availability via raw SQL (never a stored counter) | `src/lib/availability.ts` |
| Reservation writes | Create/update with overlap-error → `OverlapError` translation | `src/lib/reservations.ts` |
| Overlap detection | Sniff Postgres `23P01` / constraint name off raw errors | `src/lib/db-errors.ts` |
| Pricing engine | Advisory nightly rate (base × rules, clamped, override wins) | `src/lib/pricing.ts` |
| Date discipline | YYYY-MM-DD ↔ UTC-midnight `Date`, today/addDays helpers | `src/lib/dates.ts` |
| Nav shell | Bottom nav + appearance prefs (client component) | `src/components/NavShell.tsx` |

## Pattern Overview

**Overall:** Next.js 15 App Router monolith — UI and API share one codebase, with a thin domain layer (`src/lib/*`) in between and PostgreSQL as the source of truth.

**Key Characteristics:**
- Server Components fetch data by calling `src/lib/*` functions that hit Prisma directly — no internal HTTP hop for initial render. Pages set `export const dynamic = "force-dynamic"` (e.g. `src/app/page.tsx:9`).
- API routes (`src/app/api/**/route.ts`) exist for client mutations and exports; they Zod-validate input, call the domain layer, and return the `{data}`/`{error}` envelope.
- Availability is **DERIVED**, never stored. There is no "free rooms" counter anywhere.
- The no-double-booking guarantee lives in the **database**, not app code — a GiST `EXCLUDE` constraint on a generated `daterange` column.

## Layers

**Presentation (Server Components + client islands):**
- Purpose: Render mobile-first pages; isolated `"use client"` islands handle interactivity.
- Location: `src/app/**/page.tsx`, `src/components/*`
- Contains: Pages (async server components), reusable UI (`src/components/ui.tsx`), interactive forms/panels.
- Depends on: Domain layer (`src/lib/*`) for server-side reads; `/api/*` for client-side writes.
- Used by: The browser.

**API (route handlers):**
- Purpose: Validated mutation + export endpoints for client islands and external consumers.
- Location: `src/app/api/**/route.ts`
- Contains: Zod schemas (co-located), envelope responses, error translation.
- Depends on: `src/lib/api.ts`, `src/lib/*` domain modules, `src/lib/prisma.ts`.
- Used by: `"use client"` components via `fetch`; `/api/ical` and `/api/cron` by external systems.

**Domain (`src/lib/*`):**
- Purpose: All business logic — availability, reservations, calendar, dashboard, conflicts, housekeeping, finance, analytics, pricing, iCal in/out, auth, date/format/csv utilities.
- Location: `src/lib/`
- Contains: Pure functions + Prisma-backed query functions; raw SQL where Prisma can't express it.
- Depends on: `src/lib/prisma.ts` and each other (notably `src/lib/dates.ts`).
- Used by: Both pages and API routes.

**Data (PostgreSQL):**
- Purpose: Source of truth and correctness enforcement.
- Location: `prisma/schema.prisma` + `prisma/migrations/*`
- Contains: Tables, generated `daterange` columns, the `btree_gist` extension, the exclusion constraint.

## Data Flow

### Primary Request Path (page render)

1. Request hits Edge middleware (`src/middleware.ts:7`) → verifies session cookie or redirects to `/login`.
2. Matched page (e.g. `src/app/page.tsx:11`) runs as a server component, calling domain functions (`getTodaySummary`, `getConflicts`, `getHousekeeping`) in parallel.
3. Those functions query Prisma / raw SQL and return typed data; the page renders HTML directly. No API round-trip for the initial render.

### Mutation Path (client island → API)

1. A `"use client"` component (e.g. `src/components/ReservationForm.tsx`) `fetch`es `/api/reservations`.
2. The route handler (`src/app/api/reservations/route.ts:46`) Zod-validates the body (`zodFail` on failure), then runs a Prisma `$transaction` (guest upsert + reservation insert together, so an overlap rejection rolls the guest back).
3. On a constraint violation, `isOverlapError` (`src/lib/db-errors.ts:7`) is detected and returned as a friendly 409 — never a raw 500.
4. The client reads the `{data}`/`{error}` envelope and calls `router.refresh()` to re-render the server component with fresh data.

### Availability Derivation

1. `getAvailability(roomTypeId, from, to)` (`src/lib/availability.ts:16`) runs a single raw SQL query.
2. For each night it counts DISTINCT occupied rooms (confirmed reservations `stay @> night` UNION blocks `period @> night`) and subtracts from total non-archived rooms of the type.
3. Half-open `[)` daterange semantics mean a checkout day is free for a same-day arrival.

**State Management:**
- Server state lives in Postgres; pages are `force-dynamic` and re-fetch on every navigation.
- Client islands hold transient form state in `useState`; after a successful write they call `router.refresh()` rather than caching.
- UI appearance prefs (theme/tint) are stored in `localStorage` and applied pre-paint via an inline script (`src/app/layout.tsx:36`).

## Key Abstractions

**Response envelope:**
- Purpose: Uniform success/failure shape across all API routes.
- Examples: `src/lib/api.ts` (`ok`, `fail`, `zodFail`)
- Pattern: `{ data }` on success, `{ error }` on failure; Zod errors flattened to a single friendly message at 422.

**Derived daterange + exclusion constraint:**
- Purpose: Make double-booking structurally impossible.
- Examples: `prisma/schema.prisma:112` (`stay Unsupported("daterange")?`), `prisma/migrations/20260601114302_init/migration.sql:59,115`
- Pattern: `stay`/`period` are `GENERATED ALWAYS AS (daterange(...,'[)')) STORED`; a GiST `EXCLUDE` on `(room_id WITH =, stay WITH &&) WHERE status = 'confirmed'` rejects overlaps.

**Session token:**
- Purpose: Single-owner auth with zero dependencies, runnable in both Edge and Node.
- Examples: `src/lib/auth.ts` (`createSessionToken`, `verifySessionToken`)
- Pattern: `payload.signature` HMAC-SHA256 via Web Crypto, stored in an httpOnly cookie.

**Date-only discipline:**
- Purpose: Avoid timezone drift through Postgres `DATE` columns.
- Examples: `src/lib/dates.ts`, `src/lib/format.ts`
- Pattern: store/compare as UTC-midnight `Date`; convert to local only at display time.

## Entry Points

**Edge middleware:**
- Location: `src/middleware.ts`
- Triggers: Every request matching the matcher (all paths except `/login`, `/api/auth`, `/api/ical`, `/api/cron`, Next internals, PWA assets).
- Responsibilities: Verify the session cookie; redirect unauthenticated requests to `/login`.

**Root layout:**
- Location: `src/app/layout.tsx`
- Triggers: Every page render.
- Responsibilities: Load fonts, set PWA metadata/viewport, mount `NavShell`, apply theme before first paint.

**API route handlers:**
- Location: `src/app/api/**/route.ts`
- Triggers: `fetch` from client islands; external calls to `/api/ical/[token]/[room]` and `/api/cron/sync`.
- Responsibilities: Validate, delegate to domain layer, return envelope.

## Architectural Constraints

- **Threading:** Single Node process per server instance; one shared `PrismaClient` (`src/lib/prisma.ts`). Edge middleware runs in the Edge runtime, so auth code uses Web Crypto only (no Node `crypto`).
- **Global state:** `globalForPrisma.prisma` singleton in dev to avoid connection exhaustion (`src/lib/prisma.ts:4`). No other module-level mutable state.
- **Availability is derived:** Never store a "free rooms" counter — always compute from reservations + blocks (`src/lib/availability.ts`). This is a hard project rule.
- **DB owns correctness:** The exclusion constraint must never be weakened to make a feature easier. Migrations are verified to keep it (`scripts/migrate.mjs:82`).
- **Generated columns:** `stay`/`period` are DB-generated; declared `Unsupported("daterange")?` in Prisma so it never writes them. Migrations must strip Prisma's spurious `DROP DEFAULT` lines (`scripts/migrate.mjs`).
- **No OTA scraping / direct OTA API:** Ingestion is via owner inbox + iCal only (see `CLAUDE.md` do-NOT rules).

## Anti-Patterns

### Calling `/api/*` from a server component

**What happens:** A page makes an internal HTTP request to its own API route to fetch initial data.
**Why it's wrong:** Adds a redundant network hop and re-authentication; loses type safety.
**Do this instead:** Call the domain function directly, as `src/app/page.tsx:11` calls `getTodaySummary()`/`getConflicts()`/`getHousekeeping()` from `src/lib/*`.

### Storing an availability counter

**What happens:** Code keeps a mutable "rooms free" number and decrements it on booking.
**Why it's wrong:** Drifts out of sync and breaks correctness; explicitly forbidden by the project.
**Do this instead:** Derive availability on read via `getAvailability` (`src/lib/availability.ts`).

### Returning raw 500 on overlap

**What happens:** A booking that violates the exclusion constraint bubbles up as an unhandled 500.
**Why it's wrong:** The owner sees a crash instead of "those dates are taken."
**Do this instead:** Detect with `isOverlapError` (`src/lib/db-errors.ts`) and return a 409 friendly message, as `src/app/api/reservations/route.ts:90` does.

### Writing the generated `stay`/`period` columns

**What happens:** A migration or query tries to set `stay`/`period` directly.
**Why it's wrong:** They are `GENERATED ALWAYS` — Postgres derives them from check-in/out; writing them errors and risks the constraint.
**Do this instead:** Write `check_in`/`check_out` (or `start_date`/`end_date`) only; let the DB generate the range.

## Error Handling

**Strategy:** Validate at the boundary, translate known DB errors to friendly envelopes, let unknown errors throw.

**Patterns:**
- Zod `safeParse` on every API input; failures become `zodFail(...)` (422) with the first issue.
- Constraint violations sniffed via `isOverlapError` (`src/lib/db-errors.ts`) → `fail("Those dates are no longer available...", 409)`.
- Domain-level sentinels: `OverlapError` (`src/lib/reservations.ts:7`), `MissingGuestError` (`src/app/api/reservations/route.ts:9`) re-thrown / mapped at the route.
- Anything unrecognized is re-thrown so it surfaces as a real error rather than a silent swallow.

## Cross-Cutting Concerns

**Logging:** None beyond default Next.js; iCal sync records `lastError` per feed in the DB (`prisma/schema.prisma:260`).
**Validation:** Zod schemas co-located with each route (e.g. `src/app/api/reservations/route.ts:11`).
**Authentication:** Edge middleware + HMAC session cookie; single owner credentials from env (`src/lib/auth.ts`). Public exceptions: `/api/ical` (token in path) and `/api/cron` (background sync).

---

*Architecture analysis: 2026-06-02*
