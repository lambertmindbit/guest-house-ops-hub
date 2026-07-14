// Grant (or revoke) the vendor's platform-admin flag on this deployment.
//
//   node scripts/grant-admin.mjs you@mindbit.in            # dry run — shows what it WOULD do
//   node scripts/grant-admin.mjs you@mindbit.in --apply    # grant
//   node scripts/grant-admin.mjs you@mindbit.in --revoke --apply
//
// Deliberately a script and not an env var: a platform admin is a person, granted
// once, revocable in one command — not a value baked into a deployment that nobody
// remembers setting. And deliberately not self-service: the /admin console can grant
// modules, but it cannot mint another admin.
//
// This grants power over THIS deployment only. Each client has their own database,
// so there is no cross-client access to grant.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
const revoke = args.includes("--revoke");

function die(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

async function main() {
  if (!email) die("Usage: node scripts/grant-admin.mjs <email> [--revoke] [--apply]");

  const host = (() => {
    try { return new URL(process.env.DATABASE_URL ?? "").host; } catch { return "(unparseable)"; }
  })();

  console.log("");
  console.log("  Database :", host);
  console.log("  User     :", email);
  console.log("  Action   :", revoke ? "REVOKE platform admin" : "GRANT platform admin");
  console.log("  Mode     :", apply ? "APPLY (writes)" : "DRY RUN (no writes)");
  console.log("");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, isPlatformAdmin: true, active: true },
  });
  if (!user) die(`No user with that email on this deployment. Create the login first, then grant.`);

  console.log(`  Found: ${user.email} · role=${user.role} · active=${user.active} · platformAdmin=${user.isPlatformAdmin}`);

  const target = !revoke;
  if (user.isPlatformAdmin === target) {
    console.log(`\n  Nothing to do — already ${target ? "a platform admin" : "not a platform admin"}.\n`);
    return;
  }

  if (!apply) {
    console.log(`\n  Dry run — nothing written. Re-run with --apply to ${revoke ? "revoke" : "grant"}.\n`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { isPlatformAdmin: target } });
  console.log(`\n  ✓ ${user.email} is ${target ? "now a platform admin — /admin is open to them" : "no longer a platform admin"}.\n`);
}

main()
  .catch((e) => die(e.message))
  .finally(() => prisma.$disconnect());
