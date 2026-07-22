#!/usr/bin/env node
// Scripted client provisioning (GAP-18/US-701). ONE command to take a fresh,
// empty database to a migrated, channel-seeded, verified baseline and print an
// auto-checked readiness report.
//
//   DATABASE_URL=... DIRECT_URL=... node scripts/provision-client.mjs "<Client Name>"
//
// SCOPE BOUNDARY (deliberate): this provisions the DATABASE + APP BASELINE, which
// is what lives in this repo. Creating the Vercel project and Supabase instance and
// wiring their env is an infra step that needs your cloud tokens and can't run from
// here — it's the documented checklist around this script, not this script itself.
// Point DATABASE_URL/DIRECT_URL at the new (empty) database and run this last.
//
// Safe to re-run: migrate deploy only applies pending migrations, and the channel
// seed is idempotent (skips channels that already exist).
import { execSync } from "node:child_process";

const name = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "New client";

const CHANNELS = [
  { name: "Direct", commissionPct: 0, collectsPayment: false },
  { name: "WhatsApp", commissionPct: 0, collectsPayment: false },
  { name: "Booking.com", commissionPct: 15, collectsPayment: false },
  { name: "Agoda", commissionPct: 18, collectsPayment: true },
  { name: "MakeMyTrip", commissionPct: 18, collectsPayment: true },
];

function step(msg) { console.log(`\n▸ ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); process.exitCode = 1; }

async function main() {
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    fail("DATABASE_URL and DIRECT_URL must point at the NEW client's database.");
    return;
  }
  console.log(`Provisioning "${name}"`);

  step("Applying database migrations (prisma migrate deploy)");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  ok("schema up to date");

  // Import the client only AFTER migrate, so the generated client matches.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    step("Verifying the correctness core");
    const constraint = await prisma.$queryRaw`
      SELECT conname FROM pg_constraint WHERE conname = 'no_overlapping_confirmed_stays'`;
    if (constraint.length === 0) return fail("no_overlapping_confirmed_stays exclusion constraint is MISSING");
    ok("no_overlapping_confirmed_stays present");

    step("Seeding booking channels (idempotent)");
    let created = 0;
    for (const ch of CHANNELS) {
      const existing = await prisma.channel.findFirst({ where: { name: ch.name } });
      if (!existing) { await prisma.channel.create({ data: ch }); created += 1; }
    }
    ok(`${created} channel(s) created, ${CHANNELS.length - created} already present`);

    step("Readiness checklist (auto-verified)");
    const [propertyNamedRow, roomTypes, rooms, channels, staff] = await Promise.all([
      prisma.propertySettings.findFirst({ select: { name: true } }),
      prisma.roomType.count(),
      prisma.room.count(),
      prisma.channel.count(),
      prisma.staff.count(),
    ]);
    const report = inlineReadiness({
      propertyNamed: !!propertyNamedRow && propertyNamedRow.name !== "My Guest House",
      roomTypes, rooms, channels, staff,
    });
    for (const s of report.steps) {
      console.log(`  ${s.done ? "✓" : s.required ? "✗" : "•"} ${s.label}${s.required ? "" : " (optional)"}`);
    }
    console.log(`\n${report.bookable ? "✓ BOOKABLE" : `⧗ ${report.requiredRemaining} required step(s) remain`} — the owner finishes these in the setup wizard.`);
  } finally {
    await prisma.$disconnect();
  }
}

// Mirror of src/lib/fleet.ts bookableReadiness for the plain-script path (no TS
// loader). Keep in lockstep; the TS version is the unit-tested source of truth.
function inlineReadiness(c) {
  const steps = [
    { label: "Property details", done: c.propertyNamed, required: true },
    { label: "Room types", done: c.roomTypes > 0, required: true },
    { label: "Rooms", done: c.rooms > 0, required: true },
    { label: "Booking channels", done: c.channels > 0, required: true },
    { label: "Staff", done: c.staff > 0, required: false },
  ];
  const requiredRemaining = steps.filter((s) => s.required && !s.done).length;
  return { steps, bookable: requiredRemaining === 0, requiredRemaining };
}

main().catch((e) => { console.error(e); process.exit(1); });
