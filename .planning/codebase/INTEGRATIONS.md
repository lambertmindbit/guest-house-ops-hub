# External Integrations

**Analysis Date:** 2026-06-01

## APIs & External Services

**OTA Calendar Feeds (iCal):**
- The only external connectivity in the project. Per the project's hard rules, there is NO direct Booking.com / Agoda / MakeMyTrip API integration and no scraping — sync happens purely over standard `.ics` URLs.
- **Inbound (import):** `node-ical` fetches each owner-configured feed URL and mirrors busy `VEVENT`s into `ical`-sourced `blocks`.
  - SDK/Client: `node-ical` (`nodeIcal.async.fromURL`) in `src/lib/ical-import.ts`.
  - Auth: none — feed URLs are public/secret-in-URL OTA exports the owner pastes in (`IcalFeed` rows, managed via `src/app/api/feeds/route.ts` and `src/app/feeds/page.tsx`).
- **Outbound (export):** Token-gated public `.ics` feed per room so OTAs can read busy dates.
  - Endpoint: `src/app/api/ical/[token]/[room]/route.ts` (writer in `src/lib/ical.ts`, no external dependency).
  - Auth: `ICAL_FEED_TOKEN` compared constant-time; 404 on mismatch. Events are anonymised ("Reserved" / "Blocked").

## Data Storage

**Databases:**
- PostgreSQL (Supabase) - Single source of truth for all entities.
  - Connection: `DATABASE_URL` env var.
  - In use: Supabase, host `aws-1-ap-southeast-2.pooler.supabase.com:5432` (the Supabase **connection pooler** / session mode), `sslmode=require`.
  - Local alternative: `docker compose up -d db` (`postgres:16`, `docker-compose.yml`) for offline/parity dev.
  - Client: Prisma (`@prisma/client`), singleton in `src/lib/prisma.ts`; schema `prisma/schema.prisma`.
  - Requires `btree_gist` extension (created in `prisma/migrations/20260601114302_init/migration.sql`) for the no-double-booking GiST exclusion constraint.

**File Storage:**
- Local/repo filesystem only. PWA icons in `public/icons/`; no external object storage.

**Caching:**
- None (application-level). The public iCal export sets HTTP `cache-control: public, max-age=300` (`src/app/api/ical/[token]/[room]/route.ts`).

## Authentication & Identity

**Auth Provider:**
- Custom / homegrown (NOT next-auth, NOT Supabase Auth).
  - Implementation: `src/lib/auth.ts`. Single-owner login: credentials checked against `OWNER_EMAIL` / `OWNER_PASSWORD` via constant-time compare (`verifyCredentials`).
  - Session: HMAC-SHA-256 signed token (`payload.signature`) stored in an httpOnly cookie `ota_session`, signed with `AUTH_SECRET`. Built with Web Crypto (`crypto.subtle`) so the same code runs in Edge middleware and Node route handlers. 30-day expiry.
  - Enforcement: `src/middleware.ts` gates the whole app; matcher excludes `/login`, `/api/auth`, `/api/ical`, `/api/cron`, and static/PWA assets.
  - Routes: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`; UI `src/app/login/page.tsx`.

## Monitoring & Observability

**Error Tracking:**
- None. iCal sync failures are persisted per-feed instead: `IcalFeed.lastError` / `lastSyncedAt` updated in `src/lib/ical-import.ts`, surfaced in the feeds UI.

**Logs:**
- No structured logging framework; relies on platform (Vercel) request logs and `console`.

## CI/CD & Deployment

**Hosting:**
- Vercel (serverless). `vercel.json` present; `next build` runs `prisma generate` first.

**CI Pipeline:**
- None detected (no `.github/workflows`, no other CI config).

## Environment Configuration

**Required env vars** (documented in `.env.example`):
- `DATABASE_URL` - Supabase Postgres connection string (pooler, `sslmode=require`).
- `OWNER_EMAIL`, `OWNER_PASSWORD` - Single-owner login credentials.
- `AUTH_SECRET` - HMAC key for signing the session cookie.
- `ICAL_FEED_TOKEN` - Secret embedded in public `.ics` export URLs.
- `CRON_SECRET` - Bearer token Vercel Cron sends to authorize the daily sync.

**Secrets location:**
- `.env` (git-ignored). Production secrets set in Vercel project environment variables. Never committed (`.gitignore`).

## Webhooks & Callbacks

**Incoming:**
- Vercel Cron → `GET /api/cron/sync` (`src/app/api/cron/sync/route.ts`). Scheduled `0 2 * * *` (daily 02:00) in `vercel.json`. Authorized via `Authorization: Bearer <CRON_SECRET>`; runs `syncAllFeeds()` to refresh OTA blocks. Not behind the owner cookie.
- Manual trigger: `POST /api/sync` (`src/app/api/sync/route.ts`), behind owner auth — "Sync now" button (`src/components/ImportFeeds.tsx`).

**Outgoing:**
- None (no outbound webhooks). Outbound data exposure is limited to the pull-based iCal export feed.

---

*Integration audit: 2026-06-01*
