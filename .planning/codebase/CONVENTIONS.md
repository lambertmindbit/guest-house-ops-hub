# Coding Conventions

**Analysis Date:** 2026-06-02

## Naming Patterns

**Files:**
- React route/page files: lowercase `page.tsx` / `route.ts` inside App Router folders (`src/app/reservations/[id]/page.tsx`, `src/app/api/reservations/route.ts`).
- Dynamic segments use bracket folders: `src/app/api/reservations/[id]/cancel/route.ts`.
- Components: PascalCase `.tsx` files in `src/components/` (e.g. `ReservationForm.tsx`, `PaymentsPanel.tsx`). The shared primitives file is the lowercase exception `src/components/ui.tsx`.
- Library modules: lowercase, often hyphenated, in `src/lib/` (e.g. `db-errors.ts`, `ical-import.ts`, `api.ts`, `dates.ts`).
- Scripts: lowercase `.mjs` in `scripts/` and `prisma/` (e.g. `scripts/migrate.mjs`, `prisma/seed.mjs`).

**Functions:**
- `camelCase` for all functions: `getAvailability`, `parseDateOnly`, `verifySessionToken`, `computeNightRate`.
- API route handlers are UPPERCASE HTTP verbs exported by name: `export async function POST(...)`, `export async function GET(...)` (see `src/app/api/reservations/route.ts`).
- Envelope helpers are short verbs: `ok`, `fail`, `zodFail` (`src/lib/api.ts`).

**Variables:**
- `camelCase` for locals and params.
- `SCREAMING_SNAKE_CASE` for module-level constants: `SESSION_COOKIE`, `MAX_AGE_MS`, `CONSTRAINT_NAME`, `PAYMENT_MODE_LABELS`, `DEFAULT_POLICY`, `TAG` (in tests).

**Types:**
- `PascalCase` for types and type aliases: `NightAvailability`, `Policy`, `RoomTypeRates`, `RoomOption`, `ReservationFormValues`.
- Zod schemas: `camelCase` with a `Schema` suffix, co-located at the top of the route: `createSchema`, `listSchema` (`src/app/api/reservations/route.ts`).
- Local error classes use `PascalCase` + `Error` suffix: `class MissingGuestError extends Error {}`.

**Database (Prisma ↔ Postgres):**
- Prisma model fields are `camelCase` (`roomTypeId`, `baseRate`, `collectsPayment`); Postgres tables/columns are `snake_case` (`room_type_id`, `archived_at`) — visible in the raw SQL in `src/lib/availability.ts`.

## Code Style

**Formatting:**
- No Prettier config present. Style is hand-consistent: 2-space indent, double-quoted strings, semicolons, trailing commas in multiline literals.
- Module-leading block comments explain *why* (see every file in `src/lib/`).

**Linting:**
- ESLint flat config in `eslint.config.mjs` extending `next/core-web-vitals` and `next/typescript` via `FlatCompat`.
- Run with `npm run lint` (`next lint`). CI runs lint on every push/PR (`.github/workflows/ci.yml`).

**TypeScript:**
- `strict: true` in `tsconfig.json` (also `isolatedModules`, `noEmit`, `moduleResolution: "bundler"`, target `ES2022`).
- Path alias `@/*` → `./src/*`, mirrored in `vitest.config.ts`.

## Import Organization

**Order (observed):**
1. Third-party / framework: `next/server`, `next/link`, `react`, `zod`, `date-fns`, `@prisma/client`.
2. Internal `@/lib/*` modules: `@/lib/prisma`, `@/lib/api`, `@/lib/dates`, `@/lib/db-errors`.
3. Internal `@/components/*`.

Example (`src/app/api/reservations/route.ts`):
```typescript
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { isOverlapError } from "@/lib/db-errors";
```

**Path Aliases:**
- `@/` is the only alias, pointing at `src/`. Always prefer it over relative `../../` paths.

## Exports

- **Named exports only.** No `export default` for functions, helpers, or types (`export function ok`, `export const prisma`, `export type NightAvailability`).
- The sole `export default` usage is required by the framework: each page/component a route renders (`export default async function ReservationDetailPage`) and config objects (`export default eslintConfig`).

## Error Handling

**API envelope — every route returns one shape (`src/lib/api.ts`):**
```typescript
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
export function zodFail(error: ZodError) {
  const first = error.issues[0];
  const path = first.path.join(".");
  return fail(path ? `${path}: ${first.message}` : first.message, 422);
}
```
- Success → `{ data }`. Failure → `{ error: "message" }`. Never leak raw 500s for known cases.
- Validation failures → `zodFail` (HTTP 422) with a single human-readable `path: message`.

**The double-booking guarantee (the correctness core):**
- The DB exclusion constraint `no_overlapping_confirmed_stays` raises SQLSTATE `23P01`. Prisma does not type this, so `isOverlapError` sniffs the code/constraint name off the raw error (`src/lib/db-errors.ts`):
```typescript
export function isOverlapError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  const meta = "meta" in error ? JSON.stringify(error.meta) : "";
  return `${message} ${meta}`.includes("23P01") || `${message} ${meta}`.includes("no_overlapping_confirmed_stays");
}
```
- Routes catch it and return a friendly 409, never a 500 (`src/app/api/reservations/route.ts`):
```typescript
if (isOverlapError(error)) {
  return fail("Those dates are no longer available for this room.", 409);
}
```
- Custom domain errors (e.g. `MissingGuestError`) are caught by `instanceof` and mapped to the right status; anything unrecognized is re-thrown.

**Transactions:**
- Multi-write operations run in `prisma.$transaction(async (tx) => { ... })` so a constraint rejection rolls back everything (e.g. guest upsert + reservation insert — no orphan guests). See `src/app/api/reservations/route.ts`.

## Input Validation (Zod)

- **Zod on every API input**, co-located at the top of the route file (not in a shared schema module).
- Pattern: `const x = schema.safeParse(body); if (!x.success) return zodFail(x.error);` then use `x.data`.
- Cross-field rules via `.refine(...)` with explicit `path` and `message`:
```typescript
.refine((d) => d.checkOut > d.checkIn, { path: ["checkOut"], message: "check-out must be after check-in" })
```
- Shared field validators live in `src/lib/dates.ts` and are imported: `dateOnly` (regex `^\d{4}-\d{2}-\d{2}$`).
- GET query params are validated too — pull from `searchParams`, coerce `null` → `undefined`, then `safeParse`.

## Dates & Time

- All stays are **date-only**, anchored to UTC midnight so `YYYY-MM-DD` round-trips through Postgres `DATE` without timezone drift (`src/lib/dates.ts`):
```typescript
export function parseDateOnly(value: string): Date { return new Date(`${value}T00:00:00.000Z`); }
export function formatDateOnly(date: Date): string { return date.toISOString().slice(0, 10); }
```
- Stays are stored as a **half-open Postgres `DATERANGE` `[check-in, check-out)`** — checkout day is free for a same-day arrival. Overlap and containment use range ops (`@>`, `&&`) in raw SQL (`src/lib/availability.ts`).
- `todayDateOnly()` returns the property's local calendar date; never store a mutable "today".
- Display formatting rebuilds a *local* Date from UTC parts before `date-fns` formatting so dates never shift across the day boundary (`src/lib/format.ts` `displayDate`/`displayShortDate`).

## Prisma Decimal Handling

- Prisma returns money/percent columns as `Prisma.Decimal`. **Decimals are not serializable to Client Components** — convert with `Number(...)` in the server component before passing down (`src/app/settings/page.tsx`):
```typescript
baseRate: Number(t.baseRate),
leadEarlyAdjustPct: policy?.leadEarlyAdjustPct == null ? null : Number(policy.leadEarlyAdjustPct),
```
- For display, `displayMoney(amount: Prisma.Decimal | null)` handles the null case (`—`) and formats via `Intl.NumberFormat("en-IN", { currency: "INR" })` (`src/lib/format.ts`).

## Logging

- No logging framework. Server code throws or returns the `{ error }` envelope; CLI scripts (`scripts/migrate.mjs`) use `console.log`/`console.error` with `→`/`✓`/`✗` prefixes for human-readable progress.

## Comments

- **Comment the *why*, not the *what*.** Nearly every `src/lib/` and route file opens with a block comment explaining the rationale (timezone anchoring, derived availability, the exclusion-constraint sniffing, transaction-for-rollback reasoning).
- Inline comments flag non-obvious correctness decisions (half-open ranges, same-day turnover, constant-time compare).
- No JSDoc/TSDoc tags; types carry the contract, prose carries the reasoning.

## Function & Module Design

- Small, single-purpose functions. Domain logic lives in `src/lib/*` (pure where possible, e.g. `computeNightRate` in `src/lib/pricing.ts`); routes stay thin (validate → call lib → envelope).
- Pure functions are kept DB-free so they can be unit-tested without Postgres (pricing).
- Derived data (availability) is computed via a single raw `prisma.$queryRaw` with parameter interpolation — never stored as a counter.
- No barrel files; import directly from the module that owns the symbol.

## Auth Conventions

- Single-owner auth, zero deps (`src/lib/auth.ts`). Session is a signed `payload.signature` token in an httpOnly cookie, signed/verified with Web Crypto (`crypto.subtle`) so the same code runs in Edge middleware and Node routes.
- Credentials compared with a constant-time `safeEqual` to avoid timing leaks.
- `src/middleware.ts` gates the whole app; the `matcher` excludes `/login`, `/api/auth`, `/api/ical`, `/api/cron`, and static assets.

## Design System (CSS)

- Styling is driven by **CSS custom-property tokens + component classes** in `src/app/globals.css` (362 lines), not utility-class soup. Tailwind is imported (`@import "tailwindcss"`) but the screens use named component classes.
- Tokens are defined on `:root` (colors `--sys-*`, accents `--tint*`, radii `--r-*`, easings, shadows). Legacy Ops-Hub names alias to the system values.
- Theming is **attribute-driven on `<html>`**: `data-appearance` (light/dark), `data-tint` (green/blue/indigo/warm), `data-material` (crisp), `data-btnshape` (pill). A head script sets `data-appearance` from the OS when preference is "system".
- Component class vocabulary: `.btn` (+ modifiers `--primary/--ghost/--outline/--danger-outline/--sm/--block`), `.card`, `.input`/`.select`/`.textarea`, `.pill` (+ `--good/--warn/--danger/--ink/--teal`), `.tbl`, `.kpi`/`.kpi__value`/`.kpi__label`, `.segmented`, `.app-main`, `.row`/`.col`, `.eyebrow`, `.num`, `.shimmer`.
- Mobile-first: design for ~390px, then scale up; `.app-main` caps width and adds bottom padding for the tab bar.

## Migrations

- Never run plain `prisma migrate dev` for schema changes that touch the generated `DATERANGE` columns. Use the wrapper:
  - `npm run db:migrate:new <name>` → create + strip, review.
  - `npm run db:migrate:new <name> --apply` → create + strip + apply + verify.
- `scripts/migrate.mjs` creates with `--create-only`, deterministically strips Prisma's spurious `ALTER COLUMN "stay"/"period" DROP DEFAULT` statements on the generated columns, then (with `--apply`) runs `prisma migrate deploy` and re-verifies the `no_overlapping_confirmed_stays` exclusion constraint still exists — failing loudly if it vanished.

---

*Convention analysis: 2026-06-02*
