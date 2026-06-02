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

- **Framework preset:** Next.js (auto-detected). Build command is the default
  (`npm run build`, which runs `prisma generate && next build`).
- **Production branch:** `main`. Every push to `main` triggers a production deploy;
  every PR gets a **preview deployment** with its own URL.
- **Node:** 22.

### Environment variables (set in Vercel → Project → Settings → Environment Variables)

| Var | Value |
|-----|-------|
| `DATABASE_URL` | Supabase **transaction pooler** string, port **6543**, with `?pgbouncer=true` (serverless-safe). |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | The owner login. |
| `AUTH_SECRET` | Long random string (cookie signing). Must match nothing else; just keep it stable. |
| `ICAL_FEED_TOKEN` | Long random string; appears in public `.ics` URLs. |
| `CRON_SECRET` | Long random string; **must equal** what the cron sends (Vercel injects it as a Bearer for cron invocations). |

> **Why two different `DATABASE_URL` shapes?** Local/migrations use the *session*
> pooler (`:5432`); the Vercel serverless runtime uses the *transaction* pooler
> (`:6543?pgbouncer=true`) because each invocation is short-lived. See
> [SETUP.md](SETUP.md#connection-string-nuances-important).

### Applying migrations to production

Migrations are **not** auto-applied on deploy. Apply them against the production
database before/at release:

```bash
# with DATABASE_URL pointed at production (session pooler / 5432)
npx prisma migrate deploy
```

Or run `npm run db:migrate` locally with the prod `DATABASE_URL`. Because
migrations are additive (new nullable columns / new tables), this is safe to run
without downtime. **Never** run `prisma migrate dev` against production — see
[CONTRIBUTING](CONTRIBUTING.md#database-migrations-read-this-first).

## Vercel Cron

[`vercel.json`](../vercel.json) schedules a daily iCal import:

```json
{ "crons": [ { "path": "/api/cron/sync", "schedule": "0 2 * * *" } ] }
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
   `DATABASE_URL` and `TEST_DATABASE_URL` both pointing at it — fully isolated, no
   secrets, no production data.
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
