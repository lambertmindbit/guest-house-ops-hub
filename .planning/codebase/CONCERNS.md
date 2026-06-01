# Codebase Concerns

**Analysis Date:** 2026-06-01

## Tech Debt

**Prisma migrations require a recurring manual hand-edit on every `migrate dev`:** _(RESOLVED 2026-06-01, commit efb12d4 — automated by `scripts/migrate.mjs` / `npm run db:migrate:new`, which deterministically strips the spurious lines and verifies the exclusion constraint. History below kept for context.)_
- Issue: The `stay` (reservations) and `period` (blocks) columns are real Postgres `GENERATED ALWAYS AS (...) STORED` daterange columns, declared in Prisma as `Unsupported("daterange")?`. On every new migration that touches those tables, Prisma's diff engine emits spurious `ALTER COLUMN "stay"/"period" DROP DEFAULT` statements that must be deleted by hand from the generated SQL before applying. Dropping a default on a `GENERATED ALWAYS` column is at best a no-op and at worst risks the column definition that the no-double-booking exclusion constraint depends on.
- Files: `prisma/schema.prisma` (lines 99-100, 138-139), `prisma/migrations/20260601114302_init/migration.sql` (lines 58-59, 75-76 define the generated columns), `prisma/migrations/20260601163543_ical_feeds_and_block_source/migration.sql` (lines 4-7 document the manual removal), `prisma/migrations/20260601165448_room_last_cleaned/migration.sql` (line 2), `prisma/migrations/20260601170706_payments/migration.sql` (line 4)
- Impact: Every schema change is a manual, error-prone step. A migration applied without the edit could alter the generated columns underpinning `no_overlapping_confirmed_stays` — the project's single most important correctness guarantee (per `CLAUDE.md`). The risk is silent: the spurious statement applies without error.
- Fix approach: Document the edit as a required checklist step in the migration workflow (it is currently only captured as inline comments). Better: add a wrapper script that runs `prisma migrate dev --create-only`, strips any `DROP DEFAULT` line targeting `stay`/`period` via a deterministic post-process, then applies. Verify the exclusion constraint still exists after every migration (e.g. a smoke test querying `pg_constraint`).

**Orphan guest record left behind when a reservation is rejected for overlap:** _(RESOLVED 2026-06-01, commit efb12d4 — guest upsert + reservation insert now run in a single `prisma.$transaction`, so an overlap rejection rolls the guest back. History below kept for context.)_
- Issue: In the create-reservation handler, the guest is upserted by phone *before* the reservation insert is attempted. If the reservation then fails the overlap exclusion constraint (returned as a 409), the newly created guest row is not rolled back — the upsert and the insert are not in a shared transaction.
- Files: `src/app/api/reservations/route.ts` (lines 50-57 upsert the guest, lines 60-78 attempt the insert and catch `OverlapError`), `src/lib/reservations.ts` (lines 14-21 `createReservation`)
- Impact: A failed booking for a brand-new guest leaves a dangling guest record with no reservation. For repeat guests (matched by phone) the upsert is idempotent so only their name/email may be updated by a booking that never completed. Pollutes the guest CRM and the guests list/search.
- Fix approach: Wrap the guest upsert and reservation insert in a single `prisma.$transaction` so an overlap rejection rolls back the guest. Alternatively, resolve/validate availability before upserting the guest, accepting the small race window the DB constraint still closes.

**Revenue attribution simplified to check-in date with proration:**
- Issue: Finance attributes a booking's entire gross/commission/net to the month of its check-in date (no proration), while analytics prorates revenue by nights-in-window. The two modules use different, deliberately simplified accounting models.
- Files: `src/lib/finance.ts` (lines 43-54: "Revenue is attributed by check-in date") vs `src/lib/analytics.ts` (lines 38-72: prorates `grossAmount * nightsInWindow / totalNights`)
- Impact: A long stay straddling a month boundary is counted wholly in the arrival month by finance but split across months by analytics, so the two dashboards can disagree. Accepted as an MVP simplification, not a bug — but a reconciliation hazard if treated as authoritative accounting. No GST, no payout timing, no accrual.
- Fix approach: Document the chosen model explicitly for the owner. If period-accurate financials are needed later, unify on the prorated model and add GST/payout handling (deferred — see Missing Critical Features).

## Known Bugs

No outright defects found beyond the orphan-guest issue (categorized as tech debt above). No `TODO`/`FIXME`/`HACK` markers were found in `src/`.

## Security Considerations

**Single hardcoded owner credential with no rate limiting or account recovery:**
- Risk: Authentication compares a single `OWNER_EMAIL`/`OWNER_PASSWORD` pair from environment variables. There is no login rate limiting or lockout, no multi-user support, no password hashing (the password is stored in plaintext in env and compared directly), and no password-reset path. A signed HMAC cookie (`AUTH_SECRET`) is the only session mechanism.
- Files: `src/lib/auth.ts` (lines 74-78 `verifyCredentials`, lines 39-64 token sign/verify), `src/app/api/auth/login/route.ts` (lines 16-29, no throttling), `src/middleware.ts` (lines 7-13 gate the app)
- Current mitigation: Constant-time credential comparison (`safeEqual`, lines 67-72) mitigates timing attacks; cookie is `httpOnly`, `sameSite=lax`, and `secure` in production. The middleware matcher gates all non-public routes.
- Recommendations: Add login rate limiting / exponential backoff to blunt brute force. Hash the stored password. For Phase 1's single-owner scope these are acceptable trade-offs, but they should be revisited before any multi-user or higher-value deployment.

**Public iCal export feed exposes a room's busy dates to anyone with the URL:**
- Risk: The iCal export endpoint is intentionally excluded from the auth middleware and gated only by a shared `ICAL_FEED_TOKEN` embedded in the public feed URL. Anyone holding a feed URL can read that room's occupancy.
- Files: `src/app/api/ical/[token]/[room]/route.ts`, `src/middleware.ts` (line 19 matcher excludes `api/ical`), `.env.example` (lines documenting `ICAL_FEED_TOKEN`)
- Current mitigation: Token must match; no PII (guest names) is exposed in the feed by design — only busy/free dates.
- Recommendations: Acceptable for the OTA-readable use case. Rotate the token if a URL leaks; consider per-room tokens if finer revocation is needed.

**`.env` committed-adjacency risk is controlled but a live DB password lives in `.env`:**
- Risk: `.env` is correctly git-ignored (`.gitignore` line excluding `.env` and `.env*.local`). It contains the live Supabase `DATABASE_URL` (with DB password), owner credentials, `AUTH_SECRET`, `ICAL_FEED_TOKEN`, and `CRON_SECRET`.
- Files: `.env` (git-ignored, keys only inspected), `.gitignore`, `.env.example`
- Current mitigation: File is git-ignored; `.env.example` carries only placeholders. No secrets found in tracked source.
- Recommendations: Keep `.env` out of version control (currently correct). Because the same credentials reach production (see Scaling/Environment below), treat them as production secrets — rotate periodically and avoid pasting `.env` into shared tooling.

## Performance Bottlenecks

**Feeds synced sequentially, not in parallel:**
- Problem: `syncAllFeeds` fetches and parses each iCal feed one at a time in a `for` loop, each making a blocking network call to an external OTA.
- Files: `src/lib/ical-import.ts` (lines 63-68)
- Cause: Serial `await` inside the loop; total time scales linearly with feed count and is dominated by remote latency/timeouts.
- Improvement path: With more than a handful of feeds, parallelize with `Promise.allSettled`. Low priority at the property's current scale (few rooms/feeds), and the daily cron has loose time budget.

## Fragile Areas

**iCal all-day date parsing depends on node-ical's local-midnight behavior:**
- Files: `src/lib/ical-import.ts` (lines 13-20 `toDateOnly`, lines 32-41 mapping events to blocks)
- Why fragile: `node-ical` parses an all-day `VALUE=DATE` as local midnight, and the code reads back the local Y/M/D to recover the calendar date. This is correct only as long as node-ical keeps that behavior and the server's local timezone does not shift interpretation. A library version change, a server running in a surprising TZ, or a feed using `DATETIME`/`TZID` values could silently produce off-by-one block dates — which would corrupt derived availability.
- Safe modification: Pin/verify `node-ical` behavior on upgrade. Add a unit test with fixture `.ics` content (all-day events) asserting exact block start/end dates. Consider parsing the raw `DTSTART;VALUE=DATE` string directly rather than going through a `Date`.
- Test coverage: No tests currently exercise `ical-import.ts` (only `tests/conflict.test.ts` and `tests/availability.test.ts` exist). This is an untested, timezone-sensitive code path.

**Daily sync silently 401s if `CRON_SECRET` is unset in Vercel:**
- Files: `src/app/api/cron/sync/route.ts` (lines 7-11), `vercel.json` (cron schedule `0 2 * * *` -> `/api/cron/sync`)
- Why fragile: The handler requires both that `CRON_SECRET` is set *and* that the incoming `Authorization: Bearer` header matches. If the env var is missing in the Vercel project, `if (!secret || ...)` short-circuits to `401 Unauthorized` and the feeds simply never sync — with no alert. Stale OTA blocks then risk a double-booking the system thinks is available.
- Safe modification: Treat a missing `CRON_SECRET` as a deploy-time misconfiguration that should fail loudly (e.g. surface last-sync age on the dashboard or feeds page). `IcalFeed.lastSyncedAt`/`lastError` are tracked (`src/lib/ical-import.ts` lines 48-58) but a never-invoked cron leaves `lastSyncedAt` untouched — monitor for staleness.
- Test coverage: None for the cron route.

## Scaling Limits

**No staging/production separation — one shared Supabase database:**
- Current capacity: A single Supabase Postgres instance referenced by `DATABASE_URL` serves local development, automated tests, and the Vercel production deployment alike.
- Limit: There is no isolation. Local dev work, schema experiments, and especially the integration test suite all read/write the same database the live property depends on.
- Files: `prisma/schema.prisma` (lines 17-20 datasource reads `DATABASE_URL`), `.env` / `.env.example` (single `DATABASE_URL`), `vitest.config.ts` (lines 13-14 load env from `.env` via `dotenv/config`)
- Scaling path: Provision a separate database (or Supabase project/branch) for production vs dev/test. At minimum, point the test suite at a disposable database. See Test Coverage Gaps for the immediate data-safety angle.

## Dependencies at Risk

**`node-ical` is a CJS package requiring special bundling handling:**
- Risk: `node-ical` does not bundle cleanly under Next.js and is declared in `serverExternalPackages` so it loads at runtime instead of being bundled.
- Files: `next.config.mjs` (line 6 `serverExternalPackages: ["node-ical"]`), `package.json` (`node-ical@^0.26.1`)
- Impact: A Next.js or node-ical upgrade could break the runtime-external arrangement, taking down iCal import. Combined with the timezone fragility above, this is the project's most upgrade-sensitive dependency.
- Migration plan: Cover iCal import with fixture-based tests before upgrading either package. If it becomes unmaintained, a focused custom `.ics` parser for the (small) subset of fields used here is feasible.

## Missing Critical Features

These are deliberately deferred per `CLAUDE.md`'s roadmap, not accidental gaps. Listed so future planning treats them as known absences:
- OTA confirmation-email parser (Phase 2) — bookings from Booking.com/Agoda/MakeMyTrip still require manual entry; only iCal busy-date import exists.
- Messaging automation (Phase 3) — WhatsApp/email/SMS templates and triggers: not present.
- GST handling and payout/transaction-timing tracking (Phase 5) — finance computes commission/net/collected/outstanding only (`src/lib/finance.ts`); no tax or payout accounting.
- Dynamic pricing engine (Phase 4) — `room_types` carry `rate_floor`/`rate_ceiling` fields but no pricing logic consumes them.

## Test Coverage Gaps

**Tests run against the live/shared production database:** _(PARTIALLY RESOLVED 2026-06-01, commit efb12d4 — `tests/setup.ts` now refuses to run unless `TEST_DATABASE_URL` is set or `ALLOW_PROD_DB_TESTS=1`. The root cause — a separate test database — is still owner-action: set `TEST_DATABASE_URL`. History below kept for context.)_
- What's not tested safely: The two integration suites connect to the database from `.env`'s `DATABASE_URL`, which is the same shared Supabase instance used by production. They create and delete rooms, room types, guests, channels, and reservations.
- Files: `tests/conflict.test.ts` (lines 16-49 create fixtures, lines 42-48 `deleteMany` cleanup), `tests/availability.test.ts` (lines 23-30 create fixtures), `vitest.config.ts` (lines 13-14 `setupFiles: ["dotenv/config"]` loads `.env`)
- Risk: Running the suite against production data is a live-data-safety hazard. Cleanup is tag-scoped (`test-conflict-<timestamp>` / `test-avail-<timestamp>`) and runs in `afterAll`, so a crashed or interrupted run can leave orphan test rows in the real database. A bug in fixture teardown could also touch real records.
- Priority: High — point the test suite at a disposable/staging database (ties into the staging/prod separation gap above).

**Untested code paths:**
- What's not tested: iCal import (`src/lib/ical-import.ts`), the cron sync route (`src/app/api/cron/sync/route.ts`), auth/session logic (`src/lib/auth.ts`), finance (`src/lib/finance.ts`), and analytics (`src/lib/analytics.ts`) have no automated tests. Coverage exists only for the conflict constraint and availability derivation.
- Files: `src/lib/ical-import.ts`, `src/lib/auth.ts`, `src/lib/finance.ts`, `src/lib/analytics.ts`, `src/app/api/cron/sync/route.ts`
- Risk: Timezone regressions in iCal parsing, accounting drift between finance and analytics, and auth changes could ship unnoticed. The conflict core is well covered; everything around it is not.
- Priority: Medium — start with iCal date parsing (highest fragility + correctness impact on availability).

---

*Concerns audit: 2026-06-01*
