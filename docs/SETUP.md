# Setup — Local Development

Get a working local environment running. ~15 minutes.

## Prerequisites

- **Node 22** (CI runs on 22; use `nvm use 22`)
- **npm** (lockfile is `package-lock.json`)
- A **PostgreSQL** database. We use **Supabase** (managed Postgres). You can also
  use any Postgres 16+ that has the `btree_gist` extension available — it's
  required by the no-double-booking exclusion constraint.

There is **no Docker setup** in this repo — the database is hosted (Supabase).

## 1. Install

```bash
npm install
```

`postinstall` automatically runs `prisma generate` to build the typed client.

## 2. Database (Supabase)

Create a Supabase project (free tier is fine), then grab connection strings from
**Project Settings → Database → Connection string**.

### Connection-string nuances (important)

Supabase exposes the database three ways. This project uses two of them:

| Use | Pooler | Port | Notes |
|-----|--------|------|-------|
| **Local dev & migrations** | Session pooler (or Direct) | `5432` | Needed for Prisma migrations and Prisma Studio. The "Direct" host is IPv6-only and unreachable on many machines/CI — prefer the **Session pooler** host. |
| **Vercel serverless runtime** | Transaction pooler | `6543` | Add `?pgbouncer=true`. Set this as `DATABASE_URL` in Vercel only. |

So locally you typically point `DATABASE_URL` at the **session pooler on 5432**:

```
postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres
```

(In production on Vercel, `DATABASE_URL` uses the **transaction pooler on 6543**
with `?pgbouncer=true` — see [DEPLOYMENT.md](DEPLOYMENT.md).)

## 3. Environment variables

```bash
cp .env.example .env
```

Fill in:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string (session pooler / 5432 locally) |
| `TEST_DATABASE_URL` | **Separate, disposable** DB for the test suite (see [Testing](#5-tests--the-test-database)) |
| `OWNER_EMAIL` / `OWNER_PASSWORD` | The single owner login |
| `AUTH_SECRET` | Long random string — signs the session cookie |
| `ICAL_FEED_TOKEN` | Long random string — embedded in public `.ics` export URLs |
| `CRON_SECRET` | Long random string — authorizes the daily Vercel cron |

`.env` is git-ignored. **Never commit real secrets.**

Generate a secret quickly: `openssl rand -hex 32`.

## 4. Migrate + seed

```bash
npm run db:migrate     # applies all pending migrations (prisma migrate deploy)
npm run db:seed        # sample rooms/room types, the 5 channels, demo bookings
```

> To **create** a new migration later, use `npm run db:migrate:new <name>` —
> **not** `prisma migrate dev`. See
> [CONTRIBUTING → Database migrations](CONTRIBUTING.md#database-migrations-read-this-first).

## 5. Run

```bash
npm run dev      # http://localhost:3100
```

Log in with the `OWNER_EMAIL` / `OWNER_PASSWORD` you set.

The app is a PWA and is designed mobile-first (~390px). On desktop it shows a
sidebar shell; on mobile, an iOS-style tab bar.

## 5. Tests & the test database

The integration suite (`tests/conflict.test.ts`, `tests/availability.test.ts`)
creates and deletes **real rows**, so it has a safety gate ([`tests/setup.ts`](../tests/setup.ts)):
it refuses to run unless `TEST_DATABASE_URL` is set (or `ALLOW_PROD_DB_TESTS=1`
is explicitly set).

Point `TEST_DATABASE_URL` at a **disposable** database — never production. Two
common options:

- A second Supabase project, **or**
- A separate schema/database in the same project (we used this because the free
  tier caps projects).

Bring the test DB schema up to date the same way as prod:

```bash
# apply migrations to the test DB
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```

Then:

```bash
npm test          # one-shot
npm run test:watch
```

CI spins up an ephemeral `postgres:16` for this automatically — see
[DEPLOYMENT.md](DEPLOYMENT.md).

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `P1001` can't reach database | You're using the IPv6-only **Direct** host. Switch to the **Session pooler** host (5432). |
| Tests refuse to run | `TEST_DATABASE_URL` not set. Point it at a disposable DB. |
| Tests fail referencing a missing column | Test DB schema is stale — run `DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy`. |
| 500 with `Cannot find module .../vendor-chunks/...` | Stale dev cache — `rm -rf .next` and restart. |
| Prisma client out of date after schema change | `npx prisma generate`. |
| `node-ical` build error (`BigInt is not a function`) | Already handled via `serverExternalPackages` in `next.config.mjs` — don't remove it. |
