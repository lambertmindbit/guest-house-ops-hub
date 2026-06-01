# Testing Patterns

**Analysis Date:** 2026-06-01

## Test Framework

**Runner:**
- Vitest `^3.0.0`
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect` (Jest-compatible API). Imported explicitly per file: `import { afterAll, beforeAll, describe, expect, it } from "vitest"`.

**Run Commands:**
```bash
npm test            # vitest run --passWithNoTests  (single pass, CI-friendly)
npm run test:watch  # vitest  (watch mode)
```
No dedicated coverage script is defined (see Coverage below).

## Test File Organization

**Location:**
- Separate top-level `tests/` directory (NOT co-located with source).

**Naming:**
- `<topic>.test.ts` — e.g. `tests/conflict.test.ts`, `tests/availability.test.ts`.

**Structure:**
```
tests/
├── conflict.test.ts       # DB exclusion constraint (no double-booking)
└── availability.test.ts   # derived availability from reservations + blocks
```

## Test Strategy: Real Postgres, No Mocking

These are **integration tests against the real Supabase Postgres**, not unit tests. There is no mocking layer — the whole point is to prove the database-level guarantees (the GiST exclusion constraint and derived-availability SQL) that cannot be verified in app code alone.

- `vitest.config.ts` sets `environment: "node"`, loads env via `setupFiles: ["dotenv/config"]` (so `DATABASE_URL` from `.env` is available), and disables parallelism with `fileParallelism: false` because suites share one live database.
- The `@/` alias is configured in `vitest.config.ts` (`resolve.alias`) so tests import the real `@/lib/prisma`, `@/lib/availability`, and `@/lib/db-errors`.

## Test Structure

**Suite Organization:** One `describe` per file, focused on a single correctness invariant, with each `it` asserting one behaviour.
```typescript
describe("no-double-booking exclusion constraint", () => {
  it("accepts the first confirmed reservation", async () => { ... });
  it("rejects an overlapping confirmed reservation on the same room", async () => { ... });
  it("allows same-day turnover (checkout == next check-in)", async () => { ... });
  it("allows overlapping dates on a different room", async () => { ... });
  it("frees the dates when the blocking reservation is cancelled", async () => { ... });
});
```

**Patterns:**
- **Setup** in `beforeAll`: create an isolated room type, rooms, guest, and channel; capture their IDs into module-level `let` variables.
- **Teardown** in `afterAll`: `deleteMany` the created rows (filtered by the unique tag), then `await prisma.$disconnect()`.
- **Assertions:** prefer behaviour over internals — `expect(r.id).toBeTruthy()`, `expect(a[date]).toBe(2)`, and `await expect(promise).rejects.toSatisfy(isOverlapError)`.

## Fixture Isolation

**Unique-tag pattern (mandatory for new DB tests):** Each suite generates a unique tag so fixtures never collide with seed data or other runs, and cleanup can target exactly its own rows:
```typescript
const TAG = `test-conflict-${Date.now()}`;
// ...names derived from it: `${TAG}-type`, `${TAG}-A`, phone: TAG
```
Cleanup keys off that tag (e.g. `where: { phone: TAG }`, `where: { name: \`${TAG}-type\` }`) or off the captured IDs (`where: { id: { in: reservationIds } }`).

**Local fixture factory:** Suites define a small helper to build repetitive input — e.g. `reservation(roomTarget, checkIn, checkOut)` in `tests/conflict.test.ts`, and the `avail()` helper that wraps `getAvailability(...)` into a `{ date: available }` map in `tests/availability.test.ts`.

**Created-IDs tracking:** Rows created inside `it` blocks are pushed to an array (`reservationIds`) so `afterAll` can delete them; this avoids leaking rows when a test creates data dynamically.

## Mocking

**Framework:** None. No `vi.mock`, no spies, no fakes anywhere in `tests/`.

**What NOT to Mock:**
- The database. Conflict and availability correctness depend on Postgres behaviour (the `EXCLUDE USING gist` constraint, half-open `daterange` semantics, `generate_series`), which a mock would not reproduce. Always test against the real DB.

**What to Mock:**
- Nothing currently. If a future test needs an external service (e.g. an OTA iCal fetch), prefer injecting a local fixture/feed file over a network mock, consistent with the existing real-dependency philosophy.

## Coverage

**Requirements:** None enforced. No coverage thresholds and no coverage provider (`@vitest/coverage-*`) installed.

**Current focus:** Tests deliberately concentrate on the correctness core mandated by `CLAUDE.md` — (a) overlapping confirmed reservations on the same room are rejected, and (b) availability is derived correctly around reservations and blocks (including same-day turnover and reserved+blocked-counts-once edge cases). UI, API route handlers, auth, and the lib helpers outside conflict/availability are not yet covered.

**View Coverage:**
```bash
# Not configured. Would require adding @vitest/coverage-v8 and a coverage script.
```

## Test Types

**Unit Tests:** None in the pure sense — all current tests touch Postgres.

**Integration Tests:** The two existing suites. Scope: DB constraints and derived SQL queries through the real Prisma client.

**E2E Tests:** Not used. No Playwright/Cypress.

## Common Patterns

**Async Testing:** Every `it` is `async`; all DB calls are `await`ed. Independent fixture creation is parallelized with `Promise.all` (e.g. creating room A and room B together in `beforeAll`).

**Error / rejection Testing:** Overlap violations are asserted with `rejects.toSatisfy` against the shared predicate, reusing the same `isOverlapError` the production code uses (so the test verifies the exact detection path the API relies on):
```typescript
await expect(
  prisma.reservation.create({
    data: reservation(roomId, "2026-07-12", "2026-07-15"),
  }),
).rejects.toSatisfy(isOverlapError);
```

**Half-open daterange assertions:** Tests pin down the `[check-in, check-out)` semantics explicitly — a checkout day is free for a same-day arrival, and a stay only consumes its occupied nights:
```typescript
expect(a["2026-09-13"]).toBe(2); // same-day turnover: checkout night is open
```

**State-transition checks:** Cancelling a reservation must free its dates (drops out of the `WHERE status = 'confirmed'` constraint predicate and out of derived availability) — verified in both suites.

---

*Testing analysis: 2026-06-01*
