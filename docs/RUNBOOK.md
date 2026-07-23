# Backup & Recovery Runbook

The one document to reach for when data is at risk (GAP-1). Read it once now, not
for the first time during an incident.

## The reality on the free plan

**Supabase's free plan keeps no automated backups.** So the encrypted daily dump
this repo runs (`.github/workflows/backup.yml`) is your **only** backup. If you move
to Supabase Pro, also turn on its managed daily backups + **PITR** (point-in-time
recovery) — that takes worst-case data loss from a day down to minutes — and keep
this offsite dump as the second copy.

## Objectives (what we're promising)

| | Target (free plan) | With Supabase Pro + PITR |
|---|---|---|
| **RPO** — most data we can lose | up to **24h** (one daily dump) | **~minutes** |
| **RTO** — time to be back up | **< 1 hour** (restore a small dump) | minutes |

A guest house's data changes slowly, so a 24h RPO is tolerable — but only because the
backup is **proven to restore** (see the drill below). An untested backup is not a
backup.

## How the backup works

`.github/workflows/backup.yml` runs **daily at 01:00 UTC** (and on demand via
*Actions → Backup → Run workflow*). Each run:

1. `pg_dump` the production database (custom format), inside a `postgres:17`
   container so the client matches the server version;
2. verifies the archive is readable (`pg_restore --list`);
3. **encrypts it with AES-256** — the dump contains guest PII and must never sit in
   plaintext;
4. uploads it as a GitHub Actions **artifact** — genuinely offsite (GitHub's infra,
   separate from Supabase), retained **30 days**.

### One-time setup (required, or the job fails loudly)

Two GitHub **repository secrets** switch the backups on. Set them once.

| Secret | Value |
|---|---|
| `BACKUP_DATABASE_URL` | the **direct** prod connection — the `DIRECT_URL` from `.env` (`…pooler.supabase.com:**5432**/postgres?sslmode=require`), **not** the `:6543` pooler (`pg_dump` can't run through it) |
| `BACKUP_PASSPHRASE` | a long random string **you invent** — it encrypts/decrypts the dump. **Store it in a password manager, outside this repo.** Lose it and the backups are permanently unrecoverable |

**⚠️ The one gotcha: no quotes.** In `.env` the value is wrapped in double-quotes
(`DIRECT_URL="postgresql://…"`). The secret must **not** include them, or `pg_dump`
fails with `invalid sslmode value: "require`. The commands below strip them for you.

**Fastest — from the CLI** (the password never prints to screen):

```bash
# BACKUP_DATABASE_URL — copies DIRECT_URL from .env with the quotes stripped
grep '^DIRECT_URL=' .env | cut -d= -f2- | tr -d '"' | gh secret set BACKUP_DATABASE_URL

# BACKUP_PASSPHRASE — generate one, set it, and SAVE IT to your password manager
openssl rand -base64 32 | tee /dev/tty | gh secret set BACKUP_PASSPHRASE
#   ^ prints the passphrase once so you can copy it into your password manager
```

**Or in the UI:** *GitHub → Settings → Secrets and variables → Actions → New
repository secret*. For `BACKUP_DATABASE_URL`, paste the URL starting with
`postgresql://` and ending with `require` — no `"` at either end.

### Run it now + verify (don't wait for 01:00 UTC)

```bash
gh workflow run backup.yml          # or: Actions → Backup → Run workflow
gh run watch                        # optional — watch it go green
```

Then confirm the backup exists: **Actions → Backup → the latest run → Artifacts →**
`ota-backup-<date>` (a `.dump.gpg`). That's your first verified offsite backup.

**A harmless warning you'll see:** *"Node.js 20 is deprecated … actions/upload-artifact
forced to run on Node.js 24."* Ignore it — GitHub ran the action on a newer Node,
it's backward-compatible, and your artifact was still produced. Nothing to fix.

**If a secret is wrong** the run fails loudly (e.g. `BACKUP_DATABASE_URL secret is not
set`, or the `invalid sslmode` error above) — never silently. Fix the secret and
re-run `gh workflow run backup.yml`.

## Restore drill — do this quarterly

Prove the latest backup still restores. Download the newest artifact from *Actions →
Backup*, then:

```bash
npm run restore:drill ~/Downloads/ota-backup-<stamp>.dump.gpg
# reads BACKUP_PASSPHRASE from your env, or pass --passphrase "<value>"
```

It decrypts, restores into a throwaway local database, verifies the
`no_overlapping_confirmed_stays` correctness core and that the core tables came back
non-empty, then cleans up. It exits non-zero if anything is wrong. To also check the
row counts against live prod, add `--compare "<prod-direct-url>"`.

## Recovering for real

1. **Get the backup**: download the newest `*.dump.gpg` artifact from *Actions →
   Backup* (or use the last pre-migration dump in `~/ota-backups/`).
2. **Decrypt**: `gpg --decrypt --passphrase "<BACKUP_PASSPHRASE>" -o restore.dump ota-backup-<stamp>.dump.gpg`
3. **Restore into a FRESH Supabase project** (recommended target, not a plain
   Postgres): create a new project, then
   `pg_restore --no-owner --no-privileges -d "<new-project-direct-url>" restore.dump`.
   A handful of `supabase_vault` / `transaction_timeout` errors are **expected and
   harmless** — those are Supabase system objects. Restore into a plain Postgres is
   fine for *verifying data*, but Supabase-specific extension placement means a real
   recovery should target a Supabase project.
4. **Repoint the app**: update `DATABASE_URL` (pooler `:6543`) and `DIRECT_URL`
   (`:5432`) in the Vercel project env to the new database, and redeploy.
5. **Verify**: run the restore drill's checks against the new DB, and confirm the
   exclusion constraint is present (`no_overlapping_confirmed_stays`).

## Before any risky migration

The same discipline, on demand: take a dump and drill it *before* merging a
schema-changing PR. That's exactly what `npm run restore:drill` automates — the
manual `pg_dump` + row-count parity done throughout the enterprise-hardening work is
now one command.
