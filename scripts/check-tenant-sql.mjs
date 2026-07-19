// Fails CI if a raw SQL query touches a tenant table without scoping property_id.
//
//   node scripts/check-tenant-sql.mjs
//
// Why (US-606 / NFR-SEC-06): the Prisma tenant extension auto-injects propertyId
// for model calls, but it is BLIND to $queryRaw / $executeRaw. A raw query over a
// tenant table that forgets `property_id` leaks across one owner's properties (the
// freeRooms bug class). This guard makes that omission fail the build instead of
// shipping.
//
// Heuristic, deliberately simple: if a raw SQL block references a tenant table in a
// FROM/JOIN/UPDATE/INTO clause, the block must mention `property_id` somewhere. A
// query that is intentionally global can opt out with a `tenant-sql-ok` comment in
// or just above the block. Zero npm dependencies, so it runs first in CI.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// Tenant table names = the @@map of every model in prisma.ts's TENANT_MODELS.
// Derived (not hard-coded) so it stays in sync as models come and go.
export function tenantTablesFromSchema(schemaText, prismaLibText) {
  const set = prismaLibText.match(/const TENANT_MODELS = new Set<string>\(\[([\s\S]*?)\]\)/);
  const models = new Set([...(set?.[1] ?? "").matchAll(/"([A-Za-z0-9]+)"/g)].map((m) => m[1]));
  const tables = new Set();
  for (const m of schemaText.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    if (!models.has(m[1])) continue;
    const map = m[2].match(/@@map\("([^"]+)"\)/);
    tables.add(map ? map[1] : m[1].toLowerCase());
  }
  return tables;
}

// Find raw-SQL template blocks and flag those that touch a tenant table without a
// property_id reference (and without a tenant-sql-ok opt-out). Returns [{line}].
export function scanSource(source, tenantTables) {
  const violations = [];
  const RAW = /\$(?:queryRaw|executeRaw)(?:Unsafe)?/g;
  const clauseFor = (t) => new RegExp(`\\b(?:from|join|update|into)\\s+"?${t}"?\\b`, "i");
  let m;
  while ((m = RAW.exec(source))) {
    const open = source.indexOf("`", m.index);
    if (open === -1) continue; // not a tagged-template form → not statically checked
    const close = source.indexOf("`", open + 1);
    if (close === -1) continue;
    const block = source.slice(open + 1, close);
    const lineOf = (i) => source.slice(0, i).split("\n").length;
    // Opt-out marker in the block or on the two lines above the call.
    const preamble = source.slice(Math.max(0, source.lastIndexOf("\n", source.lastIndexOf("\n", m.index) - 1)), m.index);
    if (/tenant-sql-ok/.test(block) || /tenant-sql-ok/.test(preamble)) { RAW.lastIndex = close + 1; continue; }

    const touchesTenant = [...tenantTables].some((t) => clauseFor(t).test(block));
    if (touchesTenant && !/property_id/.test(block)) {
      violations.push({ line: lineOf(m.index) });
    }
    RAW.lastIndex = close + 1;
  }
  return violations;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  const prismaLib = readFileSync(join(ROOT, "src/lib/prisma.ts"), "utf8");
  const tenantTables = tenantTablesFromSchema(schema, prismaLib);

  const files = execFileSync("git", ["ls-files", "--", "src"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));

  const problems = [];
  for (const rel of files) {
    for (const v of scanSource(readFileSync(join(ROOT, rel), "utf8"), tenantTables)) {
      problems.push(`${rel}:${v.line}`);
    }
  }

  if (problems.length > 0) {
    console.error(`\n✗ ${problems.length} raw SQL query(ies) touch a tenant table without property_id:\n`);
    for (const p of problems) console.error(`    ${p}`);
    console.error("\n  Scope it (e.g. AND property_id = ${pid}), or add a `tenant-sql-ok` comment if it is intentionally global.\n");
    process.exit(1);
  }
  console.log(`✓ tenant-sql: ${files.length} source files, ${tenantTables.size} tenant tables, no unscoped raw SQL.`);
}
