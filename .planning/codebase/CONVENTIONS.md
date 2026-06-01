# Coding Conventions

**Analysis Date:** 2026-06-01

## Naming Patterns

**Files:**
- React components: `PascalCase.tsx` in `src/components/` (e.g. `ReservationForm.tsx`, `ChannelBadge.tsx`).
- Library/helper modules: `kebab-case.ts` or single-word lowercase in `src/lib/` (e.g. `db-errors.ts`, `ical-import.ts`, `reservations.ts`, `availability.ts`).
- Next.js App Router pages: `page.tsx`; API routes: `route.ts`; dynamic segments use bracket dirs (`src/app/reservations/[id]/edit/page.tsx`, `src/app/api/reservations/[id]/route.ts`).
- Tests: `<topic>.test.ts` in the top-level `tests/` directory (e.g. `tests/conflict.test.ts`, `tests/availability.test.ts`).

**Functions:**
- `camelCase` verbs for behaviour: `createReservation`, `getAvailability`, `verifySessionToken`, `parseDateOnly`, `todayDateOnly`.
- API route handlers are uppercase HTTP verbs as required by Next.js: `GET`, `POST`, `PATCH` (see `src/app/api/reservations/route.ts`).
- Local inline React subcomponents are `PascalCase` function declarations at the bottom of the file (e.g. `Field`, `Stat`, `Section` in `src/app/page.tsx` and `src/components/ReservationForm.tsx`).

**Variables:**
- `camelCase` throughout. Short, contextual names inside small functions (`r` for a reservation row, `s` for the today summary, `q` for a query string).
- Module-level constants are `SCREAMING_SNAKE_CASE`: `SESSION_COOKIE`, `MAX_AGE_MS`, `CONSTRAINT_NAME` (`src/lib/db-errors.ts`, `src/lib/auth.ts`).

**Types:**
- `PascalCase` for exported `type`/`class`: `NightAvailability`, `RoomOption`, `ChannelOption`, `ReservationFormValues`, `OverlapError`.
- DB column names are `snake_case` in raw SQL/migrations; Prisma maps them to `camelCase` fields (`commission_pct` → `commissionPct`, `room_type_id` → `roomTypeId`).

## Code Style

**Formatting:**
- No Prettier config present; formatting is consistent by hand: 2-space indentation, double-quoted strings, trailing commas in multi-line literals, semicolons always.
- No `.prettierrc` or `biome.json` in the repo.

**Linting:**
- ESLint flat config in `eslint.config.mjs`, extending `next/core-web-vitals` and `next/typescript` via `FlatCompat`. No custom rule overrides.
- Run with `npm run lint` (`next lint`).
- TypeScript is `strict: true` (`tsconfig.json`), targeting `ES2022`, `moduleResolution: "bundler"`, `noEmit`.

## Import Organization

**Order (observed convention):**
1. External packages first (`zod`, `next/server`, `react`, `date-fns`, `@prisma/client`).
2. Internal `@/` alias imports after (`@/lib/prisma`, `@/lib/api`, `@/components/...`).
3. `import type { ... }` is used for type-only imports (e.g. `import type { Prisma } from "@prisma/client"` in `src/lib/reservations.ts`).

**Path Aliases:**
- `@/*` → `./src/*`, configured in `tsconfig.json` (`paths`) and mirrored in `vitest.config.ts` (`resolve.alias`). Always import internal modules via `@/`, never relative `../../`.

## Error Handling

**API boundary envelope:** Every route returns a consistent envelope built from `src/lib/api.ts`:
- Success → `ok(data, status?)` → `{ data }` (default 200; reservation create returns `201`).
- Failure → `fail(message, status?)` → `{ error }` (default 400).
- Zod failures → `zodFail(error)` → `{ error: "path: message" }` with HTTP `422` (takes the first issue only).

**Validation:** Zod schemas are co-located at the top of each route file and parsed with `safeParse`; on failure the route returns `zodFail(parsed.error)` immediately. Bodies are read defensively with `await request.json().catch(() => null)` so malformed JSON becomes a clean validation error, not a 500. See `src/app/api/reservations/route.ts`.

**The booking-conflict path (correctness core):**
- The Postgres GiST exclusion constraint `no_overlapping_confirmed_stays` raises SQLSTATE `23P01` on overlap.
- `src/lib/db-errors.ts` → `isOverlapError(error)` sniffs the raw error message/`meta` for `23P01` or the constraint name (Prisma does not type this error).
- `src/lib/reservations.ts` wraps every reservation write (`createReservation`, `updateReservation`) and rethrows a domain `OverlapError` with a friendly message.
- Route handlers catch `OverlapError` and map it to HTTP `409` via `fail(error.message, 409)`. Never let a constraint violation surface as a raw 500.
- Pattern: catch the specific overlap error, `throw` everything else so unexpected failures still bubble up.

**Client-side:** `src/components/ReservationForm.tsx` checks `res.ok`, reads `json.error`, and renders it in a red alert box. 409 (overlap) and 422 (validation) both arrive as `{ error }` and are shown identically; network failures fall back to a generic message.

## Logging

**Framework:** None. No logger dependency; no stray `console.log` in `src/lib` or routes. Errors are surfaced through the `{ error }` envelope or rethrown.

## Comments

**When to Comment:** Comment the *why*, not the *what*. Comments are reserved for non-obvious decisions, especially correctness-critical ones:
- The half-open `[check-in, check-out)` daterange semantics and same-day turnover (`src/lib/availability.ts`, `prisma/migrations/20260601114302_init/migration.sql`).
- Why availability is DERIVED and never stored, and why a reserved+blocked room counts once (`src/lib/availability.ts`).
- Why the overlap error is sniffed by SQLSTATE rather than typed (`src/lib/db-errors.ts`).
- Why the Prisma client is memoized across hot-reloads (`src/lib/prisma.ts`).
- Why credential comparison is constant-time (`src/lib/auth.ts`).

**JSDoc/TSDoc:** Not used. Plain `//` line comments only; no `/** */` doc blocks anywhere in `src/`.

## Function Design

**Size:** Small and single-purpose. Lib functions stay tight (`createReservation` is ~7 lines); larger files compose many small named helpers rather than one big function.

**Parameters:** Positional for 1-3 args; an options object once a component/function grows (React props are always a single typed object). Optional fields use `?` and `.optional()` in the matching Zod schema.

**Return Values:**
- `async`/`await` everywhere; no raw `.then()` promise chains.
- Lib functions return typed domain objects/arrays; route handlers return `NextResponse` via `ok`/`fail`.
- Parallel independent reads use `Promise.all` (e.g. dashboard load in `src/app/page.tsx`, fixture setup in tests).

## Module Design

**Exports:** Named exports only — no `default` exports except where Next.js requires them (page components, `middleware`). Verified across `src/lib/*` and `src/components/*`.

**Barrel Files:** None. No `index.ts` re-export barrels; modules are imported directly by path.

**Prisma access:** Always through the shared singleton `prisma` from `@/lib/prisma`. Raw SQL uses tagged-template `prisma.$queryRaw` with interpolated params (never string concatenation) — see the availability query in `src/lib/availability.ts`.

## Project-Specific Invariants (enforce in all new code)

- **Availability is derived, never stored.** Compute from confirmed reservations + blocks; never persist a "free rooms" counter.
- **Never weaken the `no_overlapping_confirmed_stays` exclusion constraint.** If it blocks a feature, the feature has a bug.
- **Dates are date-only, anchored to UTC midnight.** Use `dateOnly` (Zod) for input, `parseDateOnly` / `formatDateOnly` for conversion (`src/lib/dates.ts`). The property's local calendar date is the reference.
- **Migration hand-edit (recurring manual step):** Prisma's generated SQL emits a spurious `ALTER COLUMN "stay"/"period" DROP DEFAULT` whenever a migration touches the `GENERATED ALWAYS` daterange columns. These must be stripped by hand from every generated migration — see the documented notes in `prisma/migrations/20260601163543_ical_feeds_and_block_source/migration.sql`, `prisma/migrations/20260601165448_room_last_cleaned/migration.sql`, and `prisma/migrations/20260601170706_payments/migration.sql`.
- **No secrets in code.** Credentials/secrets (`AUTH_SECRET`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `DATABASE_URL`) live in `.env`; `.env.example` documents placeholders.

## Styling Conventions

- Tailwind CSS v4 (`@import "tailwindcss"` in `src/app/globals.css`); configured via `@tailwindcss/postcss` (`postcss.config.mjs`). No `tailwind.config.js`.
- **Mobile-first**: layouts target a ~390px phone (`max-w-md`, `grid-cols-2`) and scale up with `lg:` variants (`lg:max-w-5xl`, `lg:grid-cols-4`). See `src/app/page.tsx`.
- Utility classes inline in JSX. Repeated class strings are hoisted to a module-level `const` (e.g. `inputClass` in `src/components/ReservationForm.tsx`).
- Neutral palette for chrome (`neutral-*`), semantic colours for state: red for conflicts/errors, amber for housekeeping.

## React/Next Conventions

- Server Components by default; data fetched directly in the async page component (`src/app/page.tsx`). Mark data-heavy pages `export const dynamic = "force-dynamic"` to avoid static caching.
- Interactive components opt in with `"use client"` and use hooks (`useState`, `useRouter`) — see `src/components/ReservationForm.tsx`.
- After mutations, navigate with `router.push(...)` then `router.refresh()` to revalidate server data.
- Auth is enforced globally in `src/middleware.ts` (Edge), with a matcher excluding `/login`, `/api/auth`, `/api/ical`, `/api/cron`, and static assets.

---

*Convention analysis: 2026-06-01*
