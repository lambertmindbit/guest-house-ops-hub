#!/usr/bin/env node
// Staged fleet upgrade (GAP-18/US-703). Rolls a migration across every client
// deployment CANARY-FIRST, takes a verified backup before each one, and HALTS the
// whole fleet the moment one fails — so a bad migration is contained to the canary.
//
//   node scripts/upgrade-fleet.mjs --manifest fleet.json [--dry-run]
//
// fleet.json (kept OUT of git — it holds connection strings):
//   [{ "name": "pineair", "directUrl": "postgres://…:5432/…", "canary": true },
//    { "name": "lawei",   "directUrl": "postgres://…:5432/…" }]
//
// Each client is upgraded with `prisma migrate deploy` against its DIRECT_URL. The
// pre-migration backup uses pg_dump; prod runs Postgres 17, so we prefer the newer
// libpq client if present (Homebrew pg_dump 16 refuses a 17 server).
import { execSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const manifestPath = args[args.indexOf("--manifest") + 1];
if (!manifestPath || !existsSync(manifestPath)) {
  console.error("Usage: node scripts/upgrade-fleet.mjs --manifest fleet.json [--dry-run]");
  process.exit(1);
}

const clients = JSON.parse(readFileSync(manifestPath, "utf8"));
// Canary-first (mirrors src/lib/fleet.ts upgradeOrder).
const ordered = [...clients.filter((c) => c.canary), ...clients.filter((c) => !c.canary)];

const PG_DUMP = ["/opt/homebrew/opt/libpq/bin/pg_dump", "/opt/homebrew/opt/postgresql@17/bin/pg_dump", "pg_dump"]
  .find((p) => { try { execSync(`${p} --version`, { stdio: "ignore" }); return true; } catch { return false; } });

const BACKUP_DIR = join(process.env.HOME ?? ".", "ota-backups");

function backup(client) {
  if (!PG_DUMP) throw new Error("no pg_dump found for the backup gate");
  mkdirSync(BACKUP_DIR, { recursive: true });
  const out = join(BACKUP_DIR, `fleet-${client.name}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.dump`);
  execSync(`${PG_DUMP} "${client.directUrl}" -Fc --no-owner --no-privileges -f "${out}"`, { stdio: "inherit" });
  // Verify the dump is a readable archive, not a truncated file.
  execSync(`${PG_DUMP.replace("pg_dump", "pg_restore")} --list "${out}" > /dev/null`, { stdio: "inherit" });
  return out;
}

function upgradeOne(client) {
  console.log(`\n══ ${client.name}${client.canary ? " (canary)" : ""} ══`);
  if (dryRun) { console.log("  [dry-run] would back up, then migrate deploy"); return { name: client.name, ok: true }; }
  try {
    console.log("  ▸ pre-migration backup (gate)");
    const dump = backup(client);
    console.log(`    ✓ ${dump}`);
    console.log("  ▸ prisma migrate deploy");
    execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: client.directUrl, DIRECT_URL: client.directUrl } });
    console.log("  ✓ upgraded");
    return { name: client.name, ok: true };
  } catch (e) {
    console.error(`  ✗ FAILED: ${e.message}`);
    return { name: client.name, ok: false, error: e.message };
  }
}

const upgraded = [];
for (const client of ordered) {
  const res = upgradeOne(client);
  if (!res.ok) {
    console.error(`\n⛔ Halting the rollout at "${res.name}". ${upgraded.length} client(s) upgraded: ${upgraded.join(", ") || "none"}.`);
    console.error("   Its pre-migration backup is in ~/ota-backups/. Fix forward or restore before continuing.");
    process.exit(1);
  }
  upgraded.push(res.name);
}
console.log(`\n✓ Fleet upgraded cleanly: ${upgraded.join(", ")}.`);
