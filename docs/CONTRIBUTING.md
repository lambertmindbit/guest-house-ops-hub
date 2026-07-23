# Contributing / Development Guide

How to work on this codebase safely. Read the migration section before touching
the schema — it's the one place where the obvious command is the wrong one.

## Workflow at a glance

1. Branch off `main` (`main` auto-deploys to production).
2. Make changes; keep commits small and logical.
3. `npm run lint && npx tsc --noEmit && npm test` must all pass.
4. Open a PR → CI runs lint + build + tests on an ephemeral Postgres.
5. Merge to `main` → Vercel deploys to production.

```bash
git checkout main && git pull
git checkout -b feature/<thing>
# …work…
npm run lint && npx tsc --noEmit && npm test
git push -u origin feature/<thing>
gh pr create --base main
```

## Database migrations (read this first)

This schema uses two things Prisma's migration **diff engine cannot model**:

- generated `DATERANGE` columns (`stay`, `period`), and
- the `no_overlapping_confirmed_stays` GiST **exclusion constraint**.

Because of this, `prisma migrate dev` emits **spurious**
`ALTER COLUMN "stay"/"period" DROP DEFAULT` statements on every new migration,
which at best no-op and at worst threaten the columns the constraint depends on.

### ✅ Always create migrations with the safe helper

```bash
npm run db:migrate:new <migration_name>           # create + auto-strip the bad lines (review, then apply)
npm run db:migrate:new <migration_name> --apply   # create + strip + apply + verify the constraint is intact
```

[`scripts/migrate.mjs`](../scripts/migrate.mjs) runs `prisma migrate dev
--create-only`, deterministically strips the spurious statements, and (with
`--apply`) applies the migration and **verifies `no_overlapping_confirmed_stays`
still exists**.

### ❌ Never run `prisma migrate dev` directly

`npm run db:migrate` is **apply-only** (`prisma migrate deploy`) — it applies
already-created migrations and can never generate the bad SQL. Use it to bring a
DB up to date; use `db:migrate:new` to author a migration. There is no safe path
that calls `prisma migrate dev` by hand.

### After creating a migration

- Review the generated SQL diff before committing.
- Migrations are **additive** by convention (new nullable columns / new tables) so
  they apply cleanly to production without downtime.
- Apply to the **test DB** too, or local tests will fail on the new schema:
  ```bash
  DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
  ```
- If you ever rename the exclusion constraint, update it in **lockstep** in three
  places: the init migration SQL, the verify query in `scripts/migrate.mjs`, and
  `CONSTRAINT_NAME` in [`src/lib/db-errors.ts`](../src/lib/db-errors.ts). The
  `tests/conflict.test.ts` test is the guard — keep it green.

## Code conventions

- **TypeScript strict.** No `any` unless truly unavoidable.
- **Named exports** preferred; `async/await` over raw promises.
- **Domain logic goes in `src/lib/`**, not in route handlers or components, so it's
  shared by Server Components and API routes.
- **API responses** use the `{ data }` / `{ error }` envelope via `ok` / `fail` /
  `zodFail` from [`src/lib/api.ts`](../src/lib/api.ts).
- **Validate every API input with Zod**, schema declared at the top of the route file.
- **Dates** are date-only `YYYY-MM-DD`, UTC-anchored via [`src/lib/dates.ts`](../src/lib/dates.ts).
  Stays are half-open `[)`. Don't introduce `new Date()`-based local-time math for
  calendar dates.
- **Money is integer paise** — a branded `Money` type ([`src/lib/money.ts`](../src/lib/money.ts)),
  stored as `BIGINT`. Convert only at the edges (`rupeesToPaise` on input,
  `paiseToRupees`/`formatPaise` on display, `moneyFromDb`/`moneyToDb` at the Prisma
  boundary). Never do rupee-float arithmetic; keep percentage splits in `money.ts` so
  rounding is defined once. Mask money for non-owner roles via
  [`src/lib/money-mask.ts`](../src/lib/money-mask.ts).
- **Comment the *why*, not the *what*** — especially around booking-conflict and
  pricing logic.
- **UI**: reuse the design-system classes (`.btn`, `.card`, `.input`, `.badge`,
  `.tbl`, `.calcell`, …) and the primitives in [`src/components/ui.tsx`](../src/components/ui.tsx).
  Mobile-first (~390px), then scale up. Wrap pages in `<main className="app-main">`.
- **Client components** are small islands: `"use client"`, do a `fetch`, then
  `router.refresh()`. Keep data in the DB.

## Adding an admin-managed entity (common pattern)

The Settings area (rooms, room types, channels, seasons, expenses) all follow the
same shape — copy an existing one:

1. Prisma model + migration (`db:migrate:new`).
2. `src/app/api/<entity>/route.ts` (GET list + POST) and
   `src/app/api/<entity>/[id]/route.ts` (PATCH/DELETE), with Zod + the `ok/fail`
   envelope. Guard deletes that would orphan history (return a friendly 409).
3. A server page (or section) that fetches via Prisma and renders a `"use client"`
   form posting to the API + `router.refresh()`.

Reference implementations: `src/app/api/rooms/*`, `src/app/api/expenses/*`,
`src/components/settings/sections.tsx`, `src/components/ExpensesPanel.tsx`.

## Testing

- **Framework:** Vitest. Config: [`vitest.config.ts`](../vitest.config.ts) (`@`
  alias to `src`, serial, env loaded from `.env`).
- **Two kinds of tests:**
  - *Pure unit* — e.g. [`tests/pricing.test.ts`](../tests/pricing.test.ts) tests the
    pure `computeNightRate` calculator; no DB.
  - *Integration* — [`tests/conflict.test.ts`](../tests/conflict.test.ts),
    [`tests/availability.test.ts`](../tests/availability.test.ts) run against a real
    Postgres and assert the DB-level constraint + derived availability.
- **Safety gate:** [`tests/setup.ts`](../tests/setup.ts) refuses to run unless
  `TEST_DATABASE_URL` is set (or `ALLOW_PROD_DB_TESTS=1`). Point it at a disposable
  DB — never production.
- **What to test:** the correctness core (conflicts, availability) and pure
  business logic (pricing). Prioritize these over UI. When you fix a bug, add a
  test that reproduces it first.

```bash
npm test            # one-shot
npm run test:watch  # watch mode
```

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push/PR:
spins up an ephemeral `postgres:16`, then **lint → `prisma migrate deploy` →
build → test**. Green CI is required before merging. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Docs

The `.html` docs are **generated** — `npm run docs:html` renders them from the
Markdown, which is the source of truth. Never hand-edit a generated `.html`; your
change is overwritten on the next run. Every doc, including the end-user
[USER-GUIDE.md](USER-GUIDE.md), now lives in this pipeline — there are no
hand-authored HTML exceptions left.

CI enforces two things, both of which broke in the past:

- **No broken links.** `npm run docs:check` walks every relative link in every
  Markdown file. Deleting a doc leaves references behind, and grep misses them.
- **The generated HTML matches its Markdown.** Edit a `.md`, forget
  `npm run docs:html`, and the published HTML quietly keeps saying the old thing.

So: after editing any `.md`, run `npm run docs:html` and commit the result.

## Security hygiene

- Never commit secrets. `.env` is git-ignored; document new vars in `.env.example`
  with placeholder values.
- Keep `ICAL_FEED_TOKEN`, `CRON_SECRET`, `AUTH_SECRET` long and random.
- Respect the [hard rules](../README.md#hard-rules-do-not-break): no OTA scraping,
  no direct OTA APIs, no stored availability counter, never weaken the exclusion
  constraint.

## Known concerns / tech debt

A standing list (what's intentional vs. worth fixing) lives under
[Known concerns](ROADMAP.md#known-concerns--tech-debt). Skim it before a large
refactor.
