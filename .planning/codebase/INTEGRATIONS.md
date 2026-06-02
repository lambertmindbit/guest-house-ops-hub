# External Integrations

**Analysis Date:** 2026-06-02

## Design Constraint: NO Direct OTA API Integration

By deliberate design, this app does **not** integrate directly with Booking.com, Agoda, or MakeMyTrip APIs, and does **not** scrape OTA extranets. Real-time connectivity APIs are gated to certified channel-manager partners and unavailable to a single property. Channels (`Direct`, `WhatsApp`, `Booking.com`, `Agoda`, `MakeMyTrip`) exist only as labels/attribution on reservations (`channels` table). OTA awareness flows one way each:
- **In:** owner-pasted iCal feed URLs (busy dates only) via `node-ical` — see iCal Import below.
- **Out:** public token-gated `.ics` export feeds OTAs can subscribe to — see iCal Export below.

Treat any task that proposes calling an OTA API or automating an extranet as out of scope.

## APIs & External Services

**Calendar sync (iCal, the only OTA-facing integration):**
- iCal Import - Pulls busy dates from OTA-provided iCal URLs into `ical`-sourced `blocks`.
  - SDK/Client: `node-ical` ^0.26.1, used in `src/lib/ical-import.ts` (`nodeIcal.async.fromURL`).
  - Source URLs: stored per room in the `ical_feeds` table (`IcalFeed` model), managed at `src/app/api/feeds/route.ts` and the UI `src/app/feeds/page.tsx` / `src/components/ImportFeeds.tsx`.
  - Sync is idempotent + self-healing: each run delete-then-inserts that feed's blocks in a transaction.
- iCal Export - Publishes a room's anonymised busy periods as an `.ics` feed OTAs can read.
  - Implementation: homegrown RFC 5545 writer in `src/lib/ical.ts` (zero dependency), served by `src/app/api/ical/[token]/[room]/route.ts`.
  - Auth: path token compared in constant time against `ICAL_FEED_TOKEN`; mismatch returns 404 (does not confirm room existence). Anonymised — only "Reserved"/"Blocked", never guest details.

**Fonts:**
- Google Fonts (Poppins) - Loaded via `next/font/google` in `src/app/layout.tsx` (weights 400/500/600/700, `display: swap`, exposed as CSS var `--font-poppins`). Self-hosted/optimized at build time by Next; no runtime call to Google.

## Data Storage

**Databases:**
- PostgreSQL (hosted on Supabase in dev/prod; PG16 locally via Docker)
  - Connection: `DATABASE_URL` env var, consumed by `prisma/schema.prisma` datasource and the `src/lib/prisma.ts` singleton.
  - Client: Prisma ^6.5.0 (`@prisma/client`).
  - **Supabase pooling (per `.env.example` guidance):** use the **session pooler / direct connection on port 5432** for Prisma **migrations** (`prisma migrate`). For serverless runtime use the **transaction pooler on port 6543 with `?pgbouncer=true`**. `sslmode=require` is expected in the connection string.
  - Correctness core is enforced in-DB, not in app code: GiST `EXCLUDE` constraint `no_overlapping_confirmed_stays` and GENERATED `daterange` columns (`stay`, `period`), added via raw SQL in `prisma/migrations/20260601114302_init/`. Requires the `btree_gist` extension (PG16).

**File Storage:**
- None. No object storage is used — by design. Guest IDs are stored as text only (`guests.id_number`); no document/photo upload (noted in `prisma/schema.prisma`).

**Caching:**
- None (application level). The public iCal export sets HTTP `cache-control: public, max-age=300`.

## Authentication & Identity

**Auth Provider:**
- Custom, single-owner, zero-dependency (no external IdP).
  - Implementation: `src/lib/auth.ts`. Session is a base64url `payload.signature` token signed with **HMAC-SHA-256 via Web Crypto** (`crypto.subtle`), stored in an `httpOnly`, `sameSite=lax`, `secure`-in-prod cookie named `ota_session` (30-day max age).
  - Credentials: `OWNER_EMAIL` / `OWNER_PASSWORD` compared in constant time (`safeEqual`). Cookie signed with `AUTH_SECRET`.
  - Login/logout routes: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`.
  - Enforcement: `src/middleware.ts` gates the whole app (Edge runtime). Matcher excludes `/login`, `/api/auth`, `/api/ical`, `/api/cron`, and Next/PWA static assets; everything else requires a valid session cookie.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry/error-tracking SDK. iCal sync failures are persisted per-feed in `ical_feeds.last_error` (`src/lib/ical-import.ts`).

**Logs:**
- Console / platform (Vercel) logs only. No structured logging library.

## CI/CD & Deployment

**Hosting:**
- Vercel (serverless). PWA-installable via `public/manifest.webmanifest`.

**CI Pipeline:**
- GitHub Actions - `.github/workflows/ci.yml`, runs on every push and pull_request.
  - Steps: checkout → setup Node 22 (npm cache) → `npm ci` → `npm run lint` → `npx prisma migrate deploy` → `npm run build` → `npm test`.
  - Uses an ephemeral `postgres:16` service container (user/pass/db `postgres`/`postgres`/`ota_test`, port 5432). No secrets, no production data. Sets both `DATABASE_URL` and `TEST_DATABASE_URL` to the throwaway DB.

## Environment Configuration

**Required env vars** (documented in `.env.example`):
- `DATABASE_URL` - Supabase/Postgres connection string (port 5432 session pooler for migrations; port 6543 `?pgbouncer=true` for serverless runtime).
- `OWNER_EMAIL`, `OWNER_PASSWORD` - Single-owner login credentials.
- `AUTH_SECRET` - HMAC key signing the session cookie.
- `ICAL_FEED_TOKEN` - Secret embedded in public `.ics` export feed URLs.
- `CRON_SECRET` - Bearer token authorizing the daily Vercel Cron call to `/api/cron/sync`.

**Optional / test:**
- `TEST_DATABASE_URL` - Disposable DB for the Vitest integration suite. If unset, tests refuse to run unless `ALLOW_PROD_DB_TESTS=1`. Guard logic: `tests/setup.ts`.

**Secrets location:**
- `.env` (git-ignored per `.gitignore`). Placeholders only in `.env.example`. Production secrets set in the Vercel project's environment variables.

## Webhooks & Callbacks

**Incoming:**
- `GET /api/cron/sync` (`src/app/api/cron/sync/route.ts`) - Daily Vercel Cron target. Defined in `vercel.json`: `{ "path": "/api/cron/sync", "schedule": "0 2 * * *" }` (02:00 daily). Not behind the owner cookie; authorized via `Authorization: Bearer <CRON_SECRET>`. Calls `syncAllFeeds()` to refresh all active iCal feeds.
- `GET /api/ical/[token]/[room]` - Public, token-gated `.ics` feed OTAs poll (busy dates only).

**Outgoing:**
- iCal feed fetches: `node-ical` performs outbound HTTP GETs to OTA-provided feed URLs during sync. No other outbound webhooks/callbacks (no messaging/email/SMS in current scope).

---

*Integration audit: 2026-06-02*
