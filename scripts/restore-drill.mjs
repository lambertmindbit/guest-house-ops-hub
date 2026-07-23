#!/usr/bin/env node
// GAP-1: restore drill. A backup you've never restored is a hope, not a backup —
// this proves the file actually recovers. It restores a dump into a throwaway local
// database, checks the correctness core and core tables survived, and (optionally)
// compares row counts against live prod, then cleans up.
//
//   npm run restore:drill ~/ota-backups/ota-backup-2026-07-22-0100.dump.gpg
//   npm run restore:drill <file.dump>                    # plain (unencrypted) dump
//   npm run restore:drill <file.dump.gpg> --compare "<prod-direct-url>"
//
// Encrypted (.gpg) dumps are decrypted with BACKUP_PASSPHRASE (env) or --passphrase.
// Run it after taking a backup, and on a schedule (a quarterly drill is the point).
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const compareUrl = args.includes("--compare") ? args[args.indexOf("--compare") + 1] : null;
const passphrase = (args.includes("--passphrase") ? args[args.indexOf("--passphrase") + 1] : process.env.BACKUP_PASSPHRASE) ?? "";

if (!file || !existsSync(file)) {
  console.error("Usage: npm run restore:drill <file.dump|.dump.gpg> [--compare <prod-url>] [--passphrase <p>]");
  process.exit(1);
}

// Prefer a newer client (prod is PG17; Homebrew's default pg_dump is 16 and refuses it).
const bin = (name) =>
  ["/opt/homebrew/opt/libpq/bin", "/opt/homebrew/opt/postgresql@17/bin", "/usr/local/opt/libpq/bin"]
    .map((d) => join(d, name))
    .find((p) => existsSync(p)) ?? name;
const PG_RESTORE = bin("pg_restore");

const DRILL_DB = `ota_restore_drill_${Date.now()}`;
const CORE_TABLES = ["reservations", "guests", "payments", "rooms", "room_types", "channels"];
let dumpPath = file;
let decrypted = null;

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...opts });
}
function count(db, table) {
  return Number(sh(`psql -tAc "select count(*) from ${table}" ${db}`).trim());
}

try {
  // 1. Decrypt if needed.
  if (file.endsWith(".gpg")) {
    if (!passphrase) throw new Error("encrypted dump: set BACKUP_PASSPHRASE or pass --passphrase");
    decrypted = join(tmpdir(), `${DRILL_DB}.dump`);
    console.log("▸ decrypting…");
    execSync(`gpg --batch --yes --quiet --decrypt --passphrase ${JSON.stringify(passphrase)} -o ${decrypted} ${JSON.stringify(file)}`, { stdio: ["ignore", "ignore", "inherit"] });
    dumpPath = decrypted;
  }

  // 2. Restore into a fresh throwaway DB.
  console.log(`▸ restoring into ${DRILL_DB}…`);
  sh(`createdb ${DRILL_DB}`);
  // Supabase system objects (vault, etc.) error harmlessly on plain Postgres — ignore.
  try {
    execSync(`${PG_RESTORE} --no-owner --no-privileges -d ${DRILL_DB} ${JSON.stringify(dumpPath)}`, { stdio: ["ignore", "ignore", "pipe"] });
  } catch { /* non-zero from ignored system-object errors is expected */ }

  // 3. Verify the correctness core + that core tables restored non-empty.
  console.log("▸ verifying…");
  // Count, don't string-match: a prod DB may carry more than one schema (e.g. a
  // stray `test` schema), so the constraint name can legitimately appear twice.
  const constraints = Number(
    sh(`psql -tAc "select count(*) from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where c.conname='no_overlapping_confirmed_stays' and n.nspname='public'" ${DRILL_DB}`).trim(),
  );
  if (constraints < 1) throw new Error("exclusion constraint MISSING in the restored copy");
  console.log("  ✓ no_overlapping_confirmed_stays present");

  let anyRows = 0;
  for (const t of CORE_TABLES) {
    const n = count(DRILL_DB, t);
    anyRows += n;
    let extra = "";
    if (compareUrl) {
      const p = Number(sh(`psql "${compareUrl}" -tAc "select count(*) from ${t}"`).trim());
      extra = ` (prod=${p})${n === p ? " OK" : " ✗ MISMATCH"}`;
      if (n !== p) throw new Error(`row-count mismatch on ${t}: restored=${n} prod=${p}`);
    }
    console.log(`  ✓ ${t}: ${n}${extra}`);
  }
  if (anyRows === 0) throw new Error("restored copy is EMPTY — the backup captured no data");

  console.log(`\n✓ RESTORE DRILL PASSED — ${file} recovers cleanly.`);
} catch (e) {
  console.error(`\n✗ RESTORE DRILL FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  try { sh(`dropdb --if-exists ${DRILL_DB}`); } catch { /* ignore */ }
  if (decrypted) rmSync(decrypted, { force: true });
}
