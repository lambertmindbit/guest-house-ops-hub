# Testing Patterns

**Analysis Date:** 2026-06-02

## Test Framework

**Runner:**
- Vitest `^3.0.0`
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect` (Chai-compatible). Async rejection assertions use `.rejects.toSatisfy(...)`.

**Run Commands:**
```bash
npm test          # vitest run --passWithNoTests  (single pass; used in CI)
npm run test:watch  # vitest  (watch mode)
```
There is no dedicated coverage script; coverage is not configured.

## Test File Organization

**Location:**
- Separate top-level `tests/` directory (NOT co-located with source).

**Files:**
- `tests/conflict.test.ts` — integration: the no-double-booking exclusion constraint.
- `tests/availability.test.ts` — integration: derived availability from reservations + blocks.
- `tests/pricing.test.ts` — pure unit tests for the rate calculator (no DB).
- `tests/setup.ts` — global safety gate (not a test file; loaded as a setup file).

**Naming:**
- `*.test.ts`. Suites named after the behavior under test (`describe("no-double-booking exclusion constraint", ...)`, `describe("derived availability", ...)`).

## vitest.config.ts

```typescript
test: {
  environment: "node",
  setupFiles: ["dotenv/config", "./tests/setup.ts"],
  fileParallelism: false,
}
```
- `environment: "node"` — these are server/DB tests, no DOM.
- `setupFiles` run `dotenv/config` first (loads `.env`), then `tests/setup.ts` (the safety gate, which can override `DATABASE_URL` before any Prisma client is imported).
- `fileParallelism: false` — integration tests share a real Postgres, so files run **serially** to avoid cross-test interference.
- `@` alias resolves to `./src` (mirrors `tsconfig.json`), so tests import `@/lib/prisma`, `@/lib/availability`, etc.

## The Safety Gate (`tests/setup.ts`)

The integration suite creates and deletes real rows, so it refuses to run against a database it isn't sure is disposable. Resolution order:

1. `TEST_DATABASE_URL` set → assign it to `DATABASE_URL` (point at a disposable/local Postgres). **Recommended.**
2. `ALLOW_PROD_DB_TESTS=1` → explicit opt-in to use the existing `DATABASE_URL`.
3. Otherwise → **throw** and refuse to run.

```typescript
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
} else if (process.env.ALLOW_PROD_DB_TESTS !== "1") {
  throw new Error("Refusing to run the integration suite against DATABASE_URL — it may be production. ...");
}
```
This runs after `dotenv/config` and before any test imports `@/lib/prisma`, so the `DATABASE_URL` override takes effect for the Prisma client.

**Local test DB:** keep a *separate* database/schema from your dev/prod data and point `TEST_DATABASE_URL` at it. Keep its schema in sync by running `prisma migrate deploy` against `TEST_DATABASE_URL` whenever migrations change.

## Test Structure (Integration)

Suite lifecycle uses isolated, tagged fixtures created in `beforeAll` and torn down in `afterAll`. The tag includes `Date.now()` so parallel-ish runs don't collide on unique fields (e.g. `guest.phone`):

```typescript
const TAG = `test-conflict-${Date.now()}`;

beforeAll(async () => {
  const roomType = await prisma.roomType.create({ data: { name: `${TAG}-type`, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 } });
  const [room, altRoom] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: roomType.id, label: `${TAG}-A` } }),
    prisma.room.create({ data: { roomTypeId: roomType.id, label: `${TAG}-B` } }),
  ]);
  // ...guest, channel
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { id: { in: reservationIds } } });
  await prisma.guest.deleteMany({ where: { phone: TAG } });
  // ...rooms, roomType, channel
  await prisma.$disconnect();
});
```

**Patterns:**
- Created reservation IDs are tracked in a module-level `reservationIds` array and bulk-deleted in cleanup.
- Cleanup deletes children before parents (reservations/blocks → guest/rooms → roomType/channel) to respect FKs.
- Always `await prisma.$disconnect()` at the end of the suite.
- A small local factory builds reservation payloads (`function reservation(roomTarget, checkIn, checkOut)`).

## Asserting the Correctness Core

The double-booking constraint test asserts on the **real Postgres exclusion violation**, recognized via `isOverlapError`:

```typescript
import { isOverlapError } from "@/lib/db-errors";

it("rejects an overlapping confirmed reservation on the same room", async () => {
  await expect(
    prisma.reservation.create({ data: reservation(roomId, "2026-07-12", "2026-07-15") }),
  ).rejects.toSatisfy(isOverlapError);
});
```

Key scenarios covered (`tests/conflict.test.ts`):
- First confirmed reservation accepted.
- Overlapping confirmed reservation on the same room rejected (`23P01`).
- Same-day turnover allowed (checkout == next check-in — half-open `[)` range).
- Overlapping dates allowed on a *different* room.
- Cancelling the blocking reservation frees the dates (drops out of the `WHERE status = 'confirmed'` predicate).

## Asserting Derived Availability

`tests/availability.test.ts` exercises `getAvailability(roomTypeId, from, to)` against real data and asserts per-night counts:

```typescript
async function avail(): Promise<Record<string, number>> {
  const nights = await getAvailability(roomTypeId, FROM, TO);
  return Object.fromEntries(nights.map((n) => [n.date, n.available]));
}
```

Scenarios: full availability when empty; a reservation reduces only its nights (checkout night stays open); a block reduces availability; a room both reserved and blocked counts once (DISTINCT occupied rooms); cancelling frees the nights.

## Pure Unit Tests (No DB)

`tests/pricing.test.ts` tests `computeNightRate` / `weekdayOf` from `@/lib/pricing` with no database and no lifecycle hooks. A `base(overrides)` helper spreads `DEFAULT_POLICY`, and a `rate(opts)` helper fills default args so each case overrides only what it asserts:

```typescript
const base = (over: Partial<Policy> = {}): Policy => ({ ...DEFAULT_POLICY, ...over });
function rate(opts: Partial<Parameters<typeof computeNightRate>[0]> & { date: string }) {
  return computeNightRate({ rates, policy: base(), seasons: [], leadDays: 10, occupancyPct: 0, override: null, ...opts });
}
```

Covers weekday UTC-stability, weekend/season/lead-time/occupancy adjustments, floor/ceiling clamps (with `applied` flags), override precedence, and compounding multipliers. Fixed reference dates are derived from the project's "today" (`2026-06-02`) so weekday math is deterministic.

## Mocking

- **No mocking framework or stubs.** Integration tests run against a real Postgres; unit tests use real pure functions. There are no `vi.mock` / fake clients in the suite.
- What to "mock": nothing — instead, point at a disposable database via `TEST_DATABASE_URL`.

## Fixtures and Factories

- No fixture files. Test data is created inline via Prisma in `beforeAll`, namespaced by a timestamped `TAG`.
- Small inline factory functions build repeated payloads (`reservation(...)`, `rate(...)`, `base(...)`).

## Coverage

- No coverage thresholds enforced; no coverage reporter configured. Priority is correctness around booking-conflict, derived availability, and pricing — not line coverage.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:
1. Spins up an **ephemeral `postgres:16` service** (ships `btree_gist`, required by the exclusion constraint) with DB `ota_test`.
2. Sets both `DATABASE_URL` and `TEST_DATABASE_URL` to that ephemeral DB — fully isolated, no secrets, no production data.
3. `npm ci` → `npm run lint` → `npx prisma migrate deploy` (applies migrations to the fresh DB) → `npm run build` → `npm test`.

Locally, mirror this: run `prisma migrate deploy` against `TEST_DATABASE_URL` to sync the test DB schema, then `npm test`.

## Common Patterns

**Async DB assertion (rejection):**
```typescript
await expect(prisma.reservation.create({ data: ... })).rejects.toSatisfy(isOverlapError);
```

**Async DB assertion (success):**
```typescript
const r = await prisma.reservation.create({ data: ... });
reservationIds.push(r.id);
expect(r.id).toBeTruthy();
```

**Per-night availability:**
```typescript
const a = await avail();
expect(a["2026-09-13"]).toBe(2); // checkout night is open (half-open range)
```

---

*Testing analysis: 2026-06-02*
