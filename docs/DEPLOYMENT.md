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

**Don't.** The production build does it — see *Migrations apply on deploy* above.
Merging a migration to `main` ships it; there is no manual step.

> **This section used to say the opposite** ("migrations are not auto-applied…
> apply them by hand"). It was left behind when the build script started
> migrating, and following it is actively harmful: hand-applying SQL out of band
> leaves `_prisma_migrations` disagreeing with the migration files, and the next
> Vercel build fails on a migration Postgres says is already applied.

Two rules that still hold:

- **Never** run `prisma migrate dev` against a real database — it offers to
  **reset** it. Use `npm run db:migrate:new <name>` to author a migration and
  `prisma migrate deploy` to apply one. See
  [CONTRIBUTING](CONTRIBUTING.md#database-migrations-read-this-first).
- Migrations are additive (new nullable columns / new tables), so they apply
  without downtime and a code rollback needs no schema change.

## Vercel Cron

[`vercel.json`](../vercel.json) pins the function region and schedules a daily
iCal import:

```json
{
  "regions": ["syd1"],
  "crons": [
    { "path": "/api/cron/sync",       "schedule": "0 2 * * *"  },
    { "path": "/api/cron/messaging",  "schedule": "30 2 * * *" },
    { "path": "/api/cron/purge-ids",  "schedule": "0 3 * * *"  }
  ]
}
```

All three are gated by `CRON_SECRET` (401 if the secret is unset or mismatched).
Vercel sends it as a Bearer token on each invocation.

| Route | Does | Runs |
|---|---|---|
| `/api/cron/sync` | iCal import | 02:00 UTC daily |
| `/api/cron/messaging` | Pre-arrival + payment-reminder messages | 02:30 UTC daily |
| `/api/cron/purge-ids` | ID-document retention purge | 03:00 UTC daily |

The owner can also trigger an import by hand from the Feeds page (`POST /api/sync`).

> **Two of these were unscheduled until 2026-07-14**, so guest messaging and the
> ID-retention purge had never run in production. The reason recorded here was
> wrong: it claimed Vercel's Hobby plan caps the *number* of cron jobs. It does
> not — **Hobby allows 100 cron jobs per project**. The only Hobby restriction is
> *frequency*: a job may run **at most once per day**, and an expression that
> would fire more often (`0 * * * *`, `*/30 * * * *`) **fails at deploy time**.
> All three schedules above are daily, so all three are allowed.
>
> Keep that in mind before adding a fourth: on Hobby, sub-daily schedules don't
> degrade — they break the deployment.

### The retention purge is a no-op until you configure it

`purgeExpiredIdDocuments()` reads `PropertySettings.idRetentionDays` and returns
immediately when it is unset or ≤ 0. Scheduling the job therefore deletes nothing
by itself. **Set a retention window in Settings to actually enforce it** — until
then, scanned guest IDs are kept indefinitely.

## Supabase

- A managed Postgres project. `btree_gist` (required by the exclusion constraint)
  is available on Supabase.
- Keep a **separate** database/schema for tests (`TEST_DATABASE_URL`) — never point
  the test suite at production.
- Back up via Supabase's built-in backups; the app stores no other persistent state.

## CI — GitHub Actions

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on **every push and
PR**:

**`test` job** — the app:

1. Spins up an ephemeral **`postgres:16`** service (ships `btree_gist`), with
   `DATABASE_URL`, `DIRECT_URL`, and `TEST_DATABASE_URL` all pointing at it — fully
   isolated, no secrets, no production data.
2. `npm ci`
3. **Lint** → `npm run lint`
4. **Typecheck** → `npx tsc --noEmit`
5. **Docs** → `npm run docs:check` (no broken links) + regenerates the HTML and
   fails if the committed HTML no longer matches its Markdown
6. **Apply migrations** → `npx prisma migrate deploy`
7. **Build** → `npm run build`
8. **Test** → `npm test`

**`agent-tests` job** — the Python assistant sidecar: installs
`assistant-agent/requirements-dev.txt` and runs `pytest -q`.

Green CI gates merges. Because CI migrates a fresh DB each run, it also continually
verifies that the hand-edited migrations (generated columns + exclusion constraint)
apply cleanly from scratch.

## Release checklist

1. Branch → PR → CI green → review the Vercel **preview** deploy.
2. Merge to `main` → Vercel deploys production, applying any migration in the
   build. **Nothing to apply by hand.**
3. Smoke-test production (log in, open the calendar, create a test booking).

## DigitalOcean (alternative host)

The app is **not** Vercel-specific: it runs as a long-lived Node server, and
DigitalOcean Managed Postgres supports `btree_gist`, so the no-double-booking
exclusion constraint survives unchanged. A complete, importable App Platform spec
lives at [`.do/app.yaml`](../.do/app.yaml) — web service, migrate job, cron jobs,
health check, Bangalore region.

**The DigitalOcean deployment lives on its own branch: `deploy/digitalocean`.**

| Branch | Holds | Why |
|---|---|---|
| `main` | The `$PORT` fix, `prisma` in `dependencies`, [`scripts/cron-ping.mjs`](../scripts/cron-ping.mjs), `.do/app.yaml` | Host-agnostic. Vercel never reads `.do/`, never runs `npm start` for a Next app, and nothing imports `cron-ping` — these cannot affect the Vercel deploy. |
| `deploy/digitalocean` | The DO Spaces storage adapter (`src/lib/storage.ts` + `src/lib/sigv4.ts`) | This *would* clash: `storage.ts` is the one file the Vercel/Supabase deployment actively uses, and the DO version replaces its internals. It must not touch `main`. |

Three things that differ from Vercel and will bite if missed:

- **Migrations need a `PRE_DEPLOY` job.** `scripts/vercel-build.sh` only migrates
  when `VERCEL_ENV=production`, which never fires off Vercel — the app would boot
  against a schema-less database. The spec's `migrate` job replaces it.
- **The health check must point at `/login`, not `/`.** Every page is behind auth,
  so `/` returns a 307 redirect, which a health check can read as unhealthy and
  restart-loop the app.
- **Sync the branch before every deploy** — `git merge main`. A deploy branch
  nobody merges into is how you ship month-old code without noticing. The merge
  stays clean because nothing was removed from `main` to create the branch.

`.do/app.yaml` schedules the same three cron routes, driven by
[`scripts/cron-ping.mjs`](../scripts/cron-ping.mjs), which signs the request with
`CRON_SECRET` the way Vercel Cron does for you. The one real difference: App
Platform allows sub-daily schedules (minimum 15 minutes), whereas Vercel Hobby
caps every job at once per day. That only matters if a job ever needs to run more
often than daily — none does today.

## Rollback

- **Code:** revert the merge commit on `main` (or redeploy a previous deployment
  from the Vercel dashboard).
- **Schema:** migrations are additive, so a code rollback generally needs no schema
  change. If a migration must be undone, write a new additive migration that
  reverses it (don't edit applied migration files).
