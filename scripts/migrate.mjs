#!/usr/bin/env node
// Safe migration helper.
//
// Prisma's diff engine repeatedly emits spurious `ALTER COLUMN "stay"/"period"
// DROP DEFAULT` statements for our GENERATED daterange columns. Applying those
// is at best a no-op and at worst risks the columns the no-double-booking
// exclusion constraint depends on — so every migration has needed a manual edit.
//
// This script removes that human step:
//   node scripts/migrate.mjs <name>            # create + strip (review, then apply)
//   node scripts/migrate.mjs <name> --apply    # create + strip + apply + verify
//
// It creates a migration with --create-only, strips the spurious lines
// deterministically, and (with --apply) applies it and verifies the constraint
// `no_overlapping_confirmed_stays` still exists.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const name = args.find((a) => !a.startsWith("--"));
if (!name) {
  console.error("Usage: node scripts/migrate.mjs <name> [--apply]");
  process.exit(1);
}

const MIGRATIONS_DIR = "prisma/migrations";

function newestMigrationDir() {
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs[dirs.length - 1];
}

// Remove the spurious DROP DEFAULT statements in all the shapes Prisma emits.
function stripSpuriousDropDefault(sql) {
  let out = sql;
  // 1) Appended to a multi-column ALTER TABLE: "..., ALTER COLUMN "x" DROP DEFAULT;"
  out = out.replace(/,\s*\n\s*ALTER COLUMN "(?:period|stay)" DROP DEFAULT;/g, ";");
  // 2) Standalone statement with its own "-- AlterTable" comment.
  out = out.replace(
    /-- AlterTable\s*\nALTER TABLE "[^"]+" ALTER COLUMN "(?:period|stay)" DROP DEFAULT;\n+/g,
    "",
  );
  // 3) Any leftover standalone statement.
  out = out.replace(
    /^ALTER TABLE "[^"]+" ALTER COLUMN "(?:period|stay)" DROP DEFAULT;\n?/gm,
    "",
  );
  return out;
}

console.log(`→ Creating migration "${name}" (--create-only)…`);
execSync(`npx prisma migrate dev --create-only --name ${name}`, { stdio: "inherit" });

const dir = newestMigrationDir();
const file = join(MIGRATIONS_DIR, dir, "migration.sql");
const original = readFileSync(file, "utf8");
const cleaned = stripSpuriousDropDefault(original);

if (cleaned !== original) {
  writeFileSync(file, cleaned);
  console.log(`✓ Stripped spurious DROP DEFAULT on generated columns in ${file}`);
} else {
  console.log("✓ No spurious DROP DEFAULT found — migration left unchanged.");
}

if (!apply) {
  console.log(`\nReview ${file}, then apply with:  npx prisma migrate dev`);
  process.exit(0);
}

console.log("→ Applying migration…");
execSync("npx prisma migrate deploy", { stdio: "inherit" });

// Verify the correctness core survived the migration.
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const rows = await prisma.$queryRaw`
  SELECT conname FROM pg_constraint WHERE conname = 'no_overlapping_confirmed_stays'
`;
await prisma.$disconnect();
if (rows.length === 0) {
  console.error("✗ FAIL: exclusion constraint no_overlapping_confirmed_stays is missing!");
  process.exit(1);
}
console.log("✓ Verified: no_overlapping_confirmed_stays constraint is present.");
