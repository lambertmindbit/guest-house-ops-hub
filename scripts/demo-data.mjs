// Demo data for a DEMO/TEST instance — guests, bookings and payments so Today,
// Calendar, Finance and Analytics all have something to show. `npm run db:seed`
// creates rooms/channels/staff/FAQs but NO guests and NO bookings, so a fresh
// instance looks dead.
//
//   node scripts/demo-data.mjs            # dry run — shows what it WOULD create
//   node scripts/demo-data.mjs --apply    # actually write it
//   node scripts/demo-data.mjs --wipe     # remove everything this script created
//
// Point it at the target database explicitly:
//   DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" \
//     node scripts/demo-data.mjs --apply
//
// SAFETY: dry-run is the default, the target host is printed before anything
// happens, and every row it creates is tagged (guest phones start with DEMO_TAG)
// so --wipe can remove exactly what it made and nothing else. Never run --apply
// against a real property's database.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const WIPE = process.argv.includes("--wipe");

// Every demo guest's phone starts with this, which is what makes --wipe precise.
const DEMO_TAG = "99000";

const DAY = 86_400_000;
const dateOnly = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d, n) => dateOnly(new Date(d.getTime() + n * DAY));
const iso = (d) => d.toISOString().slice(0, 10);
const TODAY = dateOnly(new Date());

const pick = (arr, i) => arr[i % arr.length];

const NAMES = [
  "Priya Nair", "Arjun Mehta", "Ritika Sharma", "Daniel Kharshiing", "Ananya Rao",
  "Vikram Sinha", "Meera Iyer", "Sanjay Gupta", "Ibanri Lyngdoh", "Rahul Bose",
  "Kavya Menon", "Tenzin Dorjee", "Farhan Ali", "Neha Kapoor", "Aditya Verma",
  "Lakshmi Pillai", "Rohan Das", "Shreya Ghosh",
];

const MODES = ["upi", "cash", "card", "bank"];

function log(...a) { console.log(...a); }

async function main() {
  const host = (() => {
    try { return new URL(process.env.DATABASE_URL ?? "").host; } catch { return "(unparseable)"; }
  })();

  log("");
  log("  Target database :", host);
  log("  Mode            :", WIPE ? "WIPE" : APPLY ? "APPLY (writes)" : "DRY RUN (no writes)");
  log("");

  if (/supabase/i.test(host) && (APPLY || WIPE)) {
    log("  ⚠  That host looks like Supabase — your PRODUCTION database.");
    log("     If that's really what you want, set DEMO_ALLOW_SUPABASE=1 and re-run.");
    if (process.env.DEMO_ALLOW_SUPABASE !== "1") process.exit(1);
  }

  const property = await prisma.propertySettings.findFirst();
  if (!property) {
    log("  ✗ No property found. Run `npm run db:seed` first (it creates the property).");
    process.exit(1);
  }
  const propertyId = property.id;

  if (WIPE) return wipe(propertyId);

  const rooms = await prisma.room.findMany({
    where: { propertyId, archivedAt: null },
    include: { roomType: true },
    orderBy: { label: "asc" },
  });
  const channels = await prisma.channel.findMany({ where: { propertyId } });
  if (rooms.length === 0 || channels.length === 0) {
    log("  ✗ No rooms or channels. Run `npm run db:seed` first.");
    process.exit(1);
  }
  log(`  Found ${rooms.length} rooms, ${channels.length} channels for "${property.name}".`);
  log("");

  // Bookings are laid out room by room along a timeline, so two confirmed stays
  // can never overlap — the DB's exclusion constraint would reject them anyway,
  // and a demo script that trips it is just noise.
  const plan = [];
  let n = 0;

  for (const [ri, room] of rooms.entries()) {
    const rate = Number(room.roomType.baseRate) || 250000;
    // Start ~8 weeks back and walk forward past today, leaving gaps between stays.
    let cursor = addDays(TODAY, -56 + ri * 3);

    while (cursor < addDays(TODAY, 26)) {
      const nights = 1 + ((n + ri) % 4); // 1–4 nights
      const checkIn = cursor;
      const checkOut = addDays(checkIn, nights);

      const guestName = pick(NAMES, n);
      const phone = `${DEMO_TAG}${String(100000 + n).slice(-5)}`; // 99000xxxxx, unique
      const channel = pick(channels, n + ri);
      const gross = rate * nights;

      // Status mix: mostly confirmed, an occasional cancellation so the
      // cancellation-rate metric isn't a flat zero.
      const cancelled = n % 11 === 7;

      const past = checkOut <= TODAY;
      const inHouse = checkIn <= TODAY && checkOut > TODAY;

      plan.push({
        room, channel, guestName, phone, checkIn, checkOut, nights, gross,
        status: cancelled ? "cancelled" : "confirmed",
        // Live stamps so the Today board shows real in-house / departed guests.
        checkedInAt: !cancelled && (past || inHouse) ? new Date(checkIn.getTime() + 14 * 3600_000) : null,
        checkedOutAt: !cancelled && past ? new Date(checkOut.getTime() + 11 * 3600_000) : null,
        // Past stays are settled; upcoming ones are part-paid, which gives
        // Finance a realistic "outstanding" figure instead of 0.
        paid: cancelled ? 0 : past ? gross : n % 3 === 0 ? Math.round(gross * 0.4) : 0,
        mode: pick(MODES, n),
      });

      n += 1;
      cursor = addDays(checkOut, 1 + ((n + ri) % 3)); // gap so rooms aren't 100% full
    }
  }

  const confirmed = plan.filter((p) => p.status === "confirmed");
  const inHouseNow = confirmed.filter((p) => p.checkIn <= TODAY && p.checkOut > TODAY);
  const upcoming = confirmed.filter((p) => p.checkIn > TODAY);
  const revenue = confirmed.reduce((s, p) => s + p.gross, 0);
  const collected = plan.reduce((s, p) => s + p.paid, 0);

  log("  Would create:");
  log(`    guests        ${plan.length}`);
  log(`    bookings      ${plan.length}  (${confirmed.length} confirmed, ${plan.length - confirmed.length} cancelled)`);
  log(`    in-house now  ${inHouseNow.length}`);
  log(`    upcoming      ${upcoming.length}`);
  log(`    payments      ${plan.filter((p) => p.paid > 0).length}`);
  // revenue/collected are paise (GAP-9); log in whole rupees.
  log(`    gross revenue ₹${Math.round(revenue / 100).toLocaleString("en-IN")}  ·  collected ₹${Math.round(collected / 100).toLocaleString("en-IN")}`);
  log(`    date range    ${iso(plan[0].checkIn)} → ${iso(plan[plan.length - 1].checkOut)}`);
  log("");

  if (!APPLY) {
    log("  Dry run — nothing written. Re-run with --apply to create it.");
    return;
  }

  let made = 0;
  for (const p of plan) {
    const guest = await prisma.guest.upsert({
      where: { phone: p.phone },
      update: { name: p.guestName },
      create: { name: p.guestName, phone: p.phone, propertyId },
    });

    const reservation = await prisma.reservation.create({
      data: {
        roomId: p.room.id,
        guestId: guest.id,
        channelId: p.channel.id,
        checkIn: p.checkIn,
        checkOut: p.checkOut,
        status: p.status,
        grossAmount: p.gross,
        checkedInAt: p.checkedInAt,
        checkedOutAt: p.checkedOutAt,
        arrivalTime: "14:00",
        propertyId,
      },
    });

    if (p.paid > 0) {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          amount: p.paid,
          mode: p.mode,
          isAdvance: p.paid < p.gross,
          paidAt: p.checkedInAt ?? new Date(),
          propertyId,
        },
      });
    }
    made += 1;
  }

  log(`  ✓ Created ${made} bookings with guests and payments.`);

  // A realistic housekeeping mix so the Cleaning screen isn't all-clean or
  // all-dirty: the first couple of rooms need cleaning, the rest are freshly done.
  for (const [i, room] of rooms.entries()) {
    const dirty = i < 2;
    await prisma.room.update({ where: { id: room.id }, data: { needsCleaningFlag: dirty, lastCleanedAt: dirty ? null : new Date() } });
  }
  log(`  ✓ Housekeeping: ${Math.min(2, rooms.length)} room(s) to clean, the rest ready.`);
  log("    Remove them again with:  node scripts/demo-data.mjs --wipe");
}

async function wipe(propertyId) {
  const guests = await prisma.guest.findMany({
    where: { propertyId, phone: { startsWith: DEMO_TAG } },
    select: { id: true },
  });
  const ids = guests.map((g) => g.id);
  if (ids.length === 0) {
    log("  Nothing to wipe — no demo guests found.");
    return;
  }
  const res = await prisma.reservation.findMany({ where: { guestId: { in: ids } }, select: { id: true } });
  log(`  Would delete ${res.length} bookings, their payments, and ${ids.length} guests.`);
  if (!APPLY) {
    log("  Dry run — nothing deleted. Re-run with --wipe --apply.");
    return;
  }
  await prisma.payment.deleteMany({ where: { reservationId: { in: res.map((r) => r.id) } } });
  await prisma.reservation.deleteMany({ where: { id: { in: res.map((r) => r.id) } } });
  await prisma.guest.deleteMany({ where: { id: { in: ids } } });
  // Reset the housekeeping states the demo set.
  await prisma.room.updateMany({ where: { propertyId }, data: { needsCleaningFlag: false, lastCleanedAt: null } });
  log(`  ✓ Wiped ${res.length} bookings and ${ids.length} demo guests.`);
}

main()
  .catch((e) => {
    console.error("\n  ✗ Failed:", e.message, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
