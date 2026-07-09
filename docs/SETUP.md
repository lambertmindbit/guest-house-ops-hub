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

[`prisma/schema.prisma`](../prisma/schema.prisma) uses **two** datasource URLs:

| Var | Used for | Pooler / port |
|-----|----------|---------------|
| `DATABASE_URL` | the app's **runtime** queries | Transaction pooler `6543` (+ `?pgbouncer=true&connection_limit=5`) in production; locally the session pooler on `5432` is fine |
| `DIRECT_URL` | **migrations** (`prisma migrate`) only | Session pooler / direct on `5432` — pgbouncer's transaction pooling can't run migrations |

> ⚠️ **`DIRECT_URL` is now required** — `prisma migrate` / `prisma generate`
> read it. If it's unset you'll get *"Environment variable not found: DIRECT_URL."*

Locally the simplest setup is to point **both** at the **session pooler on 5432**:

```
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres
```

(In production on Vercel, `DATABASE_URL` uses the **transaction pooler on 6543**
with `?pgbouncer=true&connection_limit=5` while `DIRECT_URL` stays on 5432 — see
[DEPLOYMENT.md](DEPLOYMENT.md).)

## 3. Environment variables

```bash
cp .env.example .env
```

Fill in:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Runtime Postgres connection (session pooler / 5432 locally) |
| `DIRECT_URL` | Direct connection for **migrations** (5432). Locally, same value as `DATABASE_URL` is fine. **Required** — Prisma errors if unset. |
| `TEST_DATABASE_URL` | **Separate, disposable** DB for the test suite (see [Testing](#5-tests--the-test-database)) |
| `OWNER_EMAIL` / `OWNER_PASSWORD` | The single owner login |
| `AUTH_SECRET` | Long random string — signs the session cookie |
| `ICAL_FEED_TOKEN` | Long random string — embedded in public `.ics` export URLs |
| `CRON_SECRET` | Long random string — authorizes the daily Vercel cron |

`.env` is git-ignored. **Never commit real secrets.**

Generate a secret quickly: `openssl rand -hex 32`.

### Optional integrations (leave unset to keep them off)

These power "kept-ready" features; the app runs fine without them.

| Var(s) | Enables | Setup |
|--------|---------|-------|
| `AGENT_TOKEN` | The AI agent's API seam (`/api/agent/*`). All agent routes return 401 if unset — the seam stays dark until an agent is pointed at it. | Set a long random string (`openssl rand -hex 32`); the **same** value goes into the Python agent's `OTA_AGENT_TOKEN` (below) and Vercel env vars. |
| `ASSISTANT_AGENT_URL`, `ASSISTANT_AGENT_TOKEN` | Points the in-app assistant (`/assistant`, `/chat`) at the Python agent's `/chat` endpoint. Unset or unreachable → falls back to a Phase-1 stub; production never breaks. | `ASSISTANT_AGENT_URL` = the agent's deployed URL + `/chat` (e.g. `https://ota-guest-agent-….run.app/chat`). `ASSISTANT_AGENT_TOKEN` (optional) must match the agent's own `ASSISTANT_AGENT_TOKEN`. |
| `INGEST_TOKEN` | Automated OTA-email ingestion via `POST /api/ingest/email`. **Not needed** for the manual paste flow on the **Inbox** screen. | Set a long random string here, and on whatever forwards emails to the endpoint (e.g. a Cloudflare Email Worker / forwarding rule). Until then, the owner just pastes confirmation emails into Inbox. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ID_BUCKET` | Guest **ID document upload**. Without it, the guest profile shows a "not configured" hint. | In Supabase → **Storage**, create a **private** bucket named `guest-ids`. Set `SUPABASE_URL` (`https://<ref>.supabase.co`) and the **service-role** key (server-only — never exposed to the client). |

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

## 6. The AI agent (`assistant-agent/`) — optional, separate process

The chat assistant is a **separate Python service**, not part of `npm run dev`.
Skip this section if you only need the app itself (it degrades gracefully to a
canned stub with no agent running).

```bash
cd assistant-agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `assistant-agent/.env`:

| Var | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | **Required.** Get one free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | Optional overrides; defaults are `gemini-2.5-flash-lite` / `gemini-2.5-flash` |
| `OTA_BASE_URL` | The OTA app's URL (e.g. your local `http://localhost:3100` or the deployed Vercel URL) |
| `OTA_AGENT_TOKEN` | **Must equal** the OTA app's `AGENT_TOKEN` above — this is the agent calling *into* the app's `/api/agent/*` seam |
| `OTA_CHANNEL_ID` | The channel id a booking is attributed to (seeded channel; check via `GET /api/channels` or Prisma Studio) |
| `ASSISTANT_AGENT_TOKEN` | Optional; if set, must equal the OTA app's `ASSISTANT_AGENT_TOKEN` above — the app calling *out to* this agent |

Run it:

```bash
uvicorn ota_guest_agent.server:api --port 8080
```

Then point the OTA app at it — in the OTA app's `.env`:
```
ASSISTANT_AGENT_URL="http://localhost:8080/chat"
```
Restart `npm run dev`; the `/assistant` and public chat pages now stream from
the real agent instead of the stub.

Run the agent's own test suite (no network, no API key needed):
```bash
pip install -r requirements-dev.txt
pytest -q
```

Full detail — tool list, prompt architecture, deployment, the single-instance
constraint — is in [`assistant-agent/README.md`](../assistant-agent/README.md)
and [ARCHITECTURE.md → AI agent architecture](ARCHITECTURE.md#ai-agent-architecture).

## 7. Tests & the test database

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
# apply migrations to the test DB (set DIRECT_URL too — migrations read it)
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
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
| Tests fail referencing a missing column | Test DB schema is stale — run `DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy`. |
| `Environment variable not found: DIRECT_URL` | The schema needs `DIRECT_URL` for migrations. Set it in `.env` (same value as `DATABASE_URL` locally). |
| 500 with `Cannot find module .../vendor-chunks/...` | Stale dev cache — `rm -rf .next` and restart. |
| Prisma client out of date after schema change | `npx prisma generate`. |
| `node-ical` build error (`BigInt is not a function`) | Already handled via `serverExternalPackages` in `next.config.mjs` — don't remove it. |
