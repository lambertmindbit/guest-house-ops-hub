# Deployment & CI

Production runs on **Vercel** with a **Supabase** Postgres database. Deploys are
git-driven: merging to `main` ships to production.

## Topology

```
GitHub (main)  ──push──►  Vercel build & deploy  ──►  https://guest-house-ops-hub.vercel.app
      │                          │
      │                          └── DATABASE_URL ──► Supabase Postgres (transaction pooler :6543)
      │
      └──push/PR──►  GitHub Actions CI (ephemeral postgres:16)
```

## Vercel

- **Framework preset:** Next.js (auto-detected). Build command is
  [`scripts/vercel-build.sh`](../scripts/vercel-build.sh) (set via `vercel.json`),
  which **applies pending DB migrations on production deploys** (`prisma migrate
  deploy`), then `prisma generate && next build`.
- **Migrations apply on deploy.** On a **production** deploy (`VERCEL_ENV=production`,
  i.e. a push to `main`) the build runs `prisma migrate deploy` first, so merging a
  migration ships it to the database. **Preview** deploys skip this — a PR can never
  migrate production. This needs `DIRECT_URL` in the Vercel Production env (below).
  A local `npm run build` never migrates (it stays `prisma generate && next build`).
- **Production branch:** `main`. Every push to `main` triggers a production deploy;
  every PR gets a **preview deployment** with its own URL.
- **Node:** 22.

### Environment variables (set in Vercel → Project → Settings → Environment Variables)

| Var | Value |
|-----|-------|
| `DATABASE_URL` | Supabase **transaction pooler** string, port **6543**, with `?pgbouncer=true&connection_limit=5` (serverless-safe; warm pooled connections instead of a TLS handshake per request). |
| `DIRECT_URL` | Supabase **direct** connection, port **5432**. Used only by `prisma migrate` (the transaction pooler can't run migrations). **Required** — Prisma errors if unset. |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | The owner login. |
| `AUTH_SECRET` | Long random string (cookie signing). Must match nothing else; just keep it stable. |
| `ICAL_FEED_TOKEN` | Long random string; appears in public `.ics` URLs. |
| `CRON_SECRET` | Long random string; **must equal** what the cron sends (Vercel injects it as a Bearer for cron invocations). |
| `AGENT_TOKEN` | *Optional.* Shared secret for the ROOT agent API seam (`/api/agent/*`). All agent routes return 401 if unset (fail closed). Set when wiring up the ROOT agent service. |
| `INGEST_TOKEN` | *Optional.* Token for the automated email-ingestion webhook (`/api/ingest/email`). Leave unset until you wire up an inbox forwarder. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ID_BUCKET` | *Optional.* Enable guest ID-document upload (private Supabase Storage bucket). Service-role key is **server-only**. Leave unset to keep the feature off. |

> **Why `DATABASE_URL` and `DIRECT_URL`?** The serverless runtime queries through
> the *transaction* pooler (`:6543?pgbouncer=true`) so short-lived invocations
> reuse warm connections instead of doing a TLS handshake each time; `prisma
> migrate` needs the *direct* connection (`:5432`, `DIRECT_URL`) because the
> transaction pooler can't run migrations. See
> [SETUP.md](SETUP.md#connection-string-nuances-important).

### Function region (latency)

Vercel functions must run in the **same region as Supabase**, or every query is a
cross-region round trip (the #1 cause of a slow app). This project's Supabase is
in **Sydney (`ap-southeast-2`)**, so functions are pinned to **`syd1`** — both via
**Settings → Functions → Function Region** (Hobby = 1 region) *and* in
[`vercel.json`](../vercel.json) (`"regions": ["syd1"]`), which takes precedence on
git-driven deploys. If you move the database, update both to match.

### Applying migrations to production

Migrations are **not** auto-applied on deploy. Apply them against the production
database before/at release:

```bash
# migrations read DIRECT_URL — point it at the production direct connection (5432)
DIRECT_URL="<prod direct 5432 URL>" npx prisma migrate deploy
```

Or run `npm run db:migrate` locally with the prod `DATABASE_URL`. Because
migrations are additive (new nullable columns / new tables), this is safe to run
without downtime. **Never** run `prisma migrate dev` against production — see
[CONTRIBUTING](CONTRIBUTING.md#database-migrations-read-this-first).

## Vercel Cron

[`vercel.json`](../vercel.json) pins the function region and schedules a daily
iCal import:

```json
{
  "regions": ["syd1"],
  "crons": [ { "path": "/api/cron/sync", "schedule": "0 2 * * *" } ]
}
```

Runs at **02:00 UTC** daily, hitting `GET /api/cron/sync`, which is gated by
`CRON_SECRET` (returns 401 if the secret is unset or mismatched). The owner can
also trigger an import manually from the Feeds page (`POST /api/sync`).

## Supabase

- A managed Postgres project. `btree_gist` (required by the exclusion constraint)
  is available on Supabase.
- Keep a **separate** database/schema for tests (`TEST_DATABASE_URL`) — never point
  the test suite at production.
- Back up via Supabase's built-in backups; the app stores no other persistent state.

## CI — GitHub Actions

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on **every push and
PR**:

1. Spins up an ephemeral **`postgres:16`** service (ships `btree_gist`), with
   `DATABASE_URL`, `DIRECT_URL`, and `TEST_DATABASE_URL` all pointing at it — fully
   isolated, no secrets, no production data.
2. `npm ci`
3. **Lint** → `npm run lint`
4. **Apply migrations** → `npx prisma migrate deploy`
5. **Build** → `npm run build`
6. **Test** → `npm test`

Green CI gates merges. Because CI migrates a fresh DB each run, it also continually
verifies that the hand-edited migrations (generated columns + exclusion constraint)
apply cleanly from scratch.

## Release checklist

1. Branch → PR → CI green → review the Vercel **preview** deploy.
2. If the PR includes a migration, apply it to the **production** DB
   (`prisma migrate deploy`).
3. Merge to `main` → Vercel deploys production.
4. Smoke-test production (log in, open the calendar, create a test booking).

## Rollback

- **Code:** revert the merge commit on `main` (or redeploy a previous deployment
  from the Vercel dashboard).
- **Schema:** migrations are additive, so a code rollback generally needs no schema
  change. If a migration must be undone, write a new additive migration that
  reverses it (don't edit applied migration files).
