# Codebase Concerns

**Analysis Date:** 2026-06-02

> Scope note: Analysis performed on branch `feature/property-management`, which
> carries Phases 1–6. As of this date that branch is **not yet merged to `main`**
> (`main` is at the Phase 1 design-handoff commit). Everything below describes the
> feature branch — the code that will land when it merges. Some items are
> intentional Phase 1 scoping decisions per `CLAUDE.md`, called out as such.

## Tech Debt

**Hand-edited raw migrations for generated columns + GiST constraint:**
- Issue: The half-open `stay`/`period` `DATERANGE` columns are `GENERATED ALWAYS … STORED` and the no-double-booking guarantee is a GiST exclusion constraint (`no_overlapping_confirmed_stays`). Prisma's diff engine cannot model either, and it repeatedly emits spurious `ALTER COLUMN "stay"/"period" DROP DEFAULT` statements on every new migration. A custom helper strips them with three regexes.
- Files: `scripts/migrate.mjs` (strip logic lines 38–54, verify step lines 80–90), `prisma/migrations/20260601114302_init/migration.sql` (generated columns lines 59/76, constraint lines 114–119).
- Impact: If a contributor runs `prisma migrate dev` directly (the package.json `db:migrate` script does exactly this) instead of `node scripts/migrate.mjs` (`db:migrate:new`), the spurious `DROP DEFAULT` lines are NOT stripped. Applying them is "at best a no-op and at worst risks the columns the exclusion constraint depends on" (the script's own comment). The two `db:migrate*` scripts pointing at different tools is a footgun.
- Fix approach: Make `db:migrate` an alias for the safe helper, or add a CI/check that fails if any migration SQL contains `ALTER COLUMN "(stay|period)" DROP DEFAULT`. The helper's post-apply constraint check (lines 82–90) only runs with `--apply`; consider a standalone "verify constraint exists" test in the suite.

**Two `db:migrate` scripts with divergent behaviour:**
- Issue: `db:migrate` → `prisma migrate dev` (unsafe for this schema); `db:migrate:new` → `node scripts/migrate.mjs` (safe). The naming does not signal which is correct.
- Files: `package.json` scripts block.
- Impact: Easy to pick the wrong one. See above.
- Fix approach: Rename or collapse to a single safe entry point.

**`tsconfig.tsbuildinfo` tracked in git:**
- Issue: The TypeScript incremental build cache is committed and is NOT in `.gitignore`.
- Files: `tsconfig.tsbuildinfo` (git-tracked), `.gitignore` (no entry for it).
- Impact: Build-artifact noise in every diff/commit touching TS; merge conflicts on a machine-specific cache file. Harmless to correctness, but pollutes history.
- Fix approach: `git rm --cached tsconfig.tsbuildinfo` and add it to `.gitignore`.

**Pricing engine re-fetches global config per room-type on the rate calendar (N+1-ish):**
- Issue: `quoteRoomType()` independently fetches policy, all seasons, overrides, availability, and property settings for each room type. The `/pricing` rate calendar calls it once per room type via `Promise.all(roomTypes.map(...))`, so policy/seasons/property are queried `roomTypes.length` times for the same 14-day window.
- Files: `src/lib/pricing.ts` `quoteRoomType` (lines 130–181, the `Promise.all` at 133–142), `src/app/pricing/page.tsx` (lines 25–26).
- Impact: For a small property (a handful of room types) this is a few extra cheap queries per page load — acceptable today. It will not scale linearly with room types and duplicates work that is constant across the page.
- Fix approach: Add a batched calendar function that loads policy/seasons/property once and computes all room types against shared inputs, reusing the pure `computeNightRate`.

**Occupancy in advisory quotes reflects current state only:**
- Issue: The occupancy adjustment uses live availability at quote time (`getAvailability` inside `quoteRoomType`, lines 140 + 158–160). A quote shown in the booking form is a point-in-time snapshot; it is not persisted with the reservation.
- Files: `src/lib/pricing.ts` (lines 140, 158–160, 89–92).
- Impact: Advisory only by design (the engine never pushes rates and never rewrites a saved booking — comment at lines 6–9). The owner may see a different suggested rate later for the same dates as bookings fill up. Not a bug, but worth knowing: there is no audit trail of what rate was suggested when.
- Fix approach: None required for Phase scope. If reproducibility is ever needed, snapshot the quote onto the reservation.

## Known Bugs

No confirmed functional bugs found in the reviewed paths. The booking-conflict
core is enforced at the database level and covered by integration tests
(`tests/conflict.test.ts`, `tests/availability.test.ts`).

**Money handled as JS `number` with `Math.round` — rounding risk:**
- Symptoms: All money crosses the server→client boundary as `Number(...)` of a Prisma `Decimal` and is summed/rounded in floating point. Commission is `Math.round((gross * pct) / 100)`; pricing rates are `Math.round`ed; finance totals accumulate floats.
- Files: `src/lib/finance.ts` `num()` (lines 4–6) + accumulation (lines 79–130), commission rounding (line 81); `src/lib/pricing.ts` `round` (line 42); client conversions in `src/app/reservations/[id]/page.tsx` (lines 91–94), `src/app/reservations/[id]/invoice/page.tsx` (lines 23–24, 102), `src/components/ReservationForm.tsx` (line 118), `src/app/api/export/reservations.csv/route.ts` (lines 31–32).
- Trigger: Amounts are whole-rupee in practice (INR, no sub-unit handling), and DB columns are `DECIMAL(10,2)`, so the blast radius is small today. Per-booking commission is rounded before summing, which can drift a rupee or two from "round the total" across many bookings.
- Workaround: Stay whole-rupee. If sub-unit precision or strict accounting is ever required, this needs integer-paise storage or decimal arithmetic end to end.

## Security Considerations

**Single-owner auth, no rate limiting, no lockout:**
- Risk: Login compares plaintext `OWNER_EMAIL`/`OWNER_PASSWORD` from env (constant-time, good) but there is no rate limiting, no failed-attempt lockout, and no captcha. Password is stored in plaintext in `.env` (not hashed — acceptable for single-owner self-host, but means env exposure = credential exposure).
- Files: `src/lib/auth.ts` `verifyCredentials` (lines 74–78), `src/app/api/auth/login/route.ts` (no throttling, lines 16–30).
- Current mitigation: Constant-time comparison (`safeEqual`, lines 67–72); HMAC-SHA256 signed httpOnly cookie (lines 39–64); `secure` cookie in production (line 83); 30-day expiry. Session token has no server-side revocation list — a leaked valid cookie works until expiry.
- Recommendations: Add basic rate limiting on `/api/auth/login` (per-IP, in-memory is fine for one box). This is explicitly deferred per `CLAUDE.md` (multi-role auth + prod hardening are out of Phase 1 scope), so flag-only — do not build now.

**No multi-user / roles:**
- Risk: A single shared credential gates everything; no per-user audit, no revocation, no least privilege.
- Files: `src/middleware.ts` (whole-app gate), `src/lib/auth.ts`.
- Current mitigation: Intentional Phase 1 design ("single-owner login — keep it simple", `CLAUDE.md`).
- Recommendations: Roadmap Phase 2+ ("multi-role auth"). No action now.

**Public token-gated routes bypass the session cookie:**
- Risk: `/api/ical/*` and `/api/cron/sync` are excluded from the middleware matcher and so are NOT behind the owner cookie. Each relies on its own shared-secret token.
- Files: `src/middleware.ts` matcher (line 19 excludes `api/ical`, `api/cron`); `src/app/api/ical/[token]/[room]/route.ts` (constant-time token check lines 8–14, 404-on-mismatch to avoid room enumeration); `src/app/api/cron/sync/route.ts` (Bearer `CRON_SECRET` check lines, returns 401 if secret unset or mismatched).
- Current mitigation: Both use constant-time / exact-match secret checks and fail closed when the env secret is unset (`!secret` → 401 for cron; empty `ICAL_FEED_TOKEN` → invalid for ical). The ical feed leaks only busy date ranges for a room, by design (OTAs must read it unauthenticated).
- Recommendations: Acceptable. Just ensure `ICAL_FEED_TOKEN` and `CRON_SECRET` are long random values (the `.env.example` says so). The ical token is a single shared secret for all feeds — rotating it invalidates every OTA subscription at once.

**CSV export — no formula-injection guard:**
- Risk: The CSV builder quotes fields containing `,`/`"`/newlines but does NOT neutralize cells beginning with `=`, `+`, `-`, or `@`. A guest name like `=HYPERLINK(...)` or a malicious channel/note would be interpreted as a formula when the accountant opens the file in Excel/Sheets.
- Files: `src/lib/csv.ts` `escape` (lines 5–8); consumed by `src/app/api/export/reservations.csv/route.ts` and `src/app/api/export/payments.csv/route.ts`. Free-text fields that reach CSV: guest name/phone, channel name, room label.
- Current mitigation: None for formula injection. Export routes ARE behind the owner cookie (not in the middleware exclusion list), so only the authenticated owner can trigger an export — this limits but does not eliminate the risk (a guest controls their own name).
- Recommendations: Prefix a single quote (or `'`/space) to any cell starting with `= + - @ \t \r`. Small, localized fix in `src/lib/csv.ts`.

## Performance Bottlenecks

**Rate calendar query fan-out:** See "N+1-ish" under Tech Debt (`src/lib/pricing.ts`,
`src/app/pricing/page.tsx`). Low impact at current scale.

No other hot paths identified. Calendar, dashboard, housekeeping, and finance
each batch their reads via `Promise.all` and aggregate in memory over a small
property's data volume.

## Fragile Areas

**Overlap-error detection by string sniffing:**
- Files: `src/lib/db-errors.ts` `isOverlapError` (sniffs the raw error for `"23P01"` or the literal constraint name `no_overlapping_confirmed_stays`).
- Why fragile: Prisma does not type the exclusion-violation error, so the code searches `message` + `JSON.stringify(meta)` for substrings. Renaming the constraint, a Prisma version that changes error shape, or a localized Postgres message could silently break the friendly-409 path and surface a raw 500 instead.
- Safe modification: If you rename the constraint, update `CONSTRAINT_NAME` here AND `scripts/migrate.mjs` verify query AND the init migration in lockstep. The `409` behaviour is exercised by `tests/conflict.test.ts` — keep that test as the guard.
- Test coverage: Covered for reservations create. Other write paths that can hit the constraint (reservation update `stay`, cancel/reactivate) should be checked.

**Migration-time generated columns + constraint:** See Tech Debt. The whole
correctness core depends on hand-maintained SQL surviving every future migration.

**Manual cleaning-flag override vs derived cleanliness:**
- Files: `src/lib/housekeeping.ts` (needsCleaning logic lines 53–58); `prisma/schema.prisma` `Room.needsCleaningFlag`, `Room.lastCleanedAt`.
- Why fragile: "Needs cleaning" is `needsCleaningFlag || (lastDeparture exists && lastCleanedAt < lastDeparture)` — a mix of a manual boolean override AND a derived signal from the most-recent past checkout. The two can disagree: marking a room clean updates `lastCleanedAt`, but a stale `needsCleaningFlag=true` would keep it dirty regardless. This is correct by current design but is two sources of truth for one fact.
- Safe modification: When changing the cleaning workflow, decide explicitly whether the manual flag should be cleared on "mark clean". Maintenance blocks (`blocks` table) are a separate concept from cleanliness — do not conflate them.
- Test coverage: No automated test for housekeeping derivation.

## Scaling Limits

Not a concern for the stated use case (one small guest house, single owner,
phone-first). All queries operate over a few rooms and a small reservation
volume. No pagination on list endpoints (`GET /api/reservations`,
`GET /api/guests`) — fine at this scale, would need attention only at
thousands of rows.

## Dependencies at Risk

No at-risk dependencies. The stack is intentionally lean (`@prisma/client`,
`next`, `react`, `zod`, `date-fns`, `node-ical`) and pinned to current major
versions in `package.json`. No heavy or abandoned packages observed.

## Missing Critical Features

These are roadmap-deferred per `CLAUDE.md` — listed for completeness, NOT as
defects to fix now:

**OTA email parsing / iCal-driven ingestion (Phase 2):**
- Problem: Bookings from Booking.com/Agoda/MakeMyTrip are not auto-ingested from the owner's inbox. iCal import exists (`src/lib/ical-import.ts`, feeds + cron) but email parsing does not.
- Blocks: Fully hands-off multi-channel sync. By design — direct OTA APIs are off-limits for a single property.

**Messaging automation (Phase 3):** WhatsApp/email/SMS templates and triggers — not built.

**ID document / photo upload + server-side PDF — flagged, intentionally not built:**
- Problem: Guest ID is text-only (`idNumber`); the schema comment explicitly notes no document/photo upload "which would need object storage" (`prisma/schema.prisma` lines 93–95). The invoice is a printable HTML page using the browser's Print-to-PDF, not a server-generated PDF.
- Files: `src/app/reservations/[id]/invoice/page.tsx`, `src/components/PrintButton.tsx` ("Print / Save PDF").
- Blocks: Storing scanned IDs and emailing finished PDF invoices. Deferred until object storage is in scope.

**Production hardening / multi-role auth (Phase 2+):** Deferred per `CLAUDE.md`.

## Test Coverage Gaps

**No automated tests for API routes or the pricing data-wrapper:**
- What's not tested: Every route handler under `src/app/api/**` (create/update/cancel reservation HTTP behaviour, validation, the 409/422 envelopes, auth/login, CSV export, settings, payments, expenses). The async `quoteRoomType` wrapper in `src/lib/pricing.ts` (DB fetch + assembly) is untested; only the pure `computeNightRate` calculator is covered.
- Files with coverage today: `tests/pricing.test.ts` (pure pricing math), `tests/conflict.test.ts` + `tests/availability.test.ts` (DB-level conflict + derived availability integration tests), `tests/setup.ts` (test-DB guard).
- Risk: Regressions in route validation, the friendly-error mapping (`isOverlapError` path), money math in finance/CSV, and housekeeping derivation would not be caught by CI. The string-sniffing overlap detector and the migration constraint are the highest-value untested-at-the-route-level areas.
- Priority: Medium. The single most important correctness rule (no double-booking) IS tested at the DB layer and verified by `scripts/migrate.mjs --apply`. Adding a thin route-level test for the create-overlap → 409 path and for `quoteRoomType` would close the biggest gaps.

**CI runs lint + build + tests on every push/PR** (`.github/workflows/ci.yml`
with an ephemeral `postgres:16`), so what tests exist do gate merges — the gap
is breadth of tests, not whether they run.

---

*Concerns audit: 2026-06-02*
