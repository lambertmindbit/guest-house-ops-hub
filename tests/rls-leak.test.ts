import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unscopedPrisma, __resetTenantResolution } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { withRlsTenant } from "@/lib/rls";

// GAP-12 (DB layer). The whole point: a RAW query with no WHERE clause, run through
// withRlsTenant(A), must still see only property A's rows — proving Row-Level
// Security contains unscoped raw SQL at the database, not just in app code. And it
// must be a NO-OP for the normal (bypass) path.

const TAG = `rls-${Date.now()}`;
let propA: string, propB: string;
let roomA: string, roomB: string, guestA: string, guestB: string, chA: string, chB: string;

async function seedProperty(suffix: string) {
  const p = await unscopedPrisma.propertySettings.create({ data: { name: `${TAG}-${suffix}` } });
  const [rt, guest, channel] = await withTenant(p.id, async () => {
    const rt = await prisma.roomType.create({ data: { name: `${TAG}-${suffix}-t`, baseRate: 200_000, maxOccupancy: 2, rateFloor: 100_000, rateCeiling: 500_000 } });
    const guest = await prisma.guest.create({ data: { name: `${TAG}-${suffix}-g`, phone: `${TAG}-${suffix}` } });
    const channel = await prisma.channel.create({ data: { name: `${TAG}-${suffix}-c`, commissionPct: 0, collectsPayment: false } });
    return [rt, guest, channel];
  });
  const room = await withTenant(p.id, () => prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-${suffix}-A` } }));
  await withTenant(p.id, () =>
    prisma.reservation.create({ data: { roomId: room.id, guestId: guest.id, channelId: channel.id, checkIn: new Date("2031-01-10"), checkOut: new Date("2031-01-12"), grossAmount: 300_000 } }),
  );
  return { propertyId: p.id, roomId: room.id, guestId: guest.id, channelId: channel.id };
}

beforeAll(async () => {
  __resetTenantResolution();
  const a = await seedProperty("A");
  const b = await seedProperty("B");
  propA = a.propertyId; roomA = a.roomId; guestA = a.guestId; chA = a.channelId;
  propB = b.propertyId; roomB = b.roomId; guestB = b.guestId; chB = b.channelId;
});

afterAll(async () => {
  for (const pid of [propA, propB]) {
    await unscopedPrisma.reservation.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.room.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.guest.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.channel.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.roomType.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.propertySettings.deleteMany({ where: { id: pid } });
  }
  __resetTenantResolution();
  await prisma.$disconnect();
});

// The property ids present in an UNSCOPED raw read of reservations, restricted to
// our two test rows so unrelated data in the DB doesn't matter.
async function propertyIdsSeenBy(client: { $queryRawUnsafe: <T>(q: string, ...a: unknown[]) => Promise<T> }): Promise<string[]> {
  const rows = await client.$queryRawUnsafe<{ property_id: string }[]>(
    `SELECT property_id FROM reservations WHERE property_id IN ($1, $2)`,
    propA,
    propB,
  );
  return [...new Set(rows.map((r) => r.property_id))].sort();
}

describe("RLS leak containment (GAP-12)", () => {
  it("an unscoped raw SELECT inside withRlsTenant(A) sees ONLY property A", async () => {
    const seen = await withRlsTenant(propA, (tx) => propertyIdsSeenBy(tx));
    expect(seen).toEqual([propA]); // B is invisible even with no WHERE clause
  });

  it("and inside withRlsTenant(B) sees ONLY property B", async () => {
    const seen = await withRlsTenant(propB, (tx) => propertyIdsSeenBy(tx));
    expect(seen).toEqual([propB]);
  });

  it("is a NO-OP off the tenant path: the normal (bypass) client still sees both", async () => {
    const seen = await propertyIdsSeenBy(unscopedPrisma);
    expect(seen).toEqual([propA, propB].sort());
  });

  it("writes are contained too: app_tenant cannot INSERT a row for another property", async () => {
    // Attempt, inside tenant A's context, to write a reservation tagged to B.
    await expect(
      withRlsTenant(propA, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO reservations (id, room_id, guest_id, channel_id, check_in, check_out, status, property_id)
           VALUES ($1,$2,$3,$4,$5,$6,'confirmed',$7)`,
          `${TAG}-evil`, roomB, guestB, chB, new Date("2031-02-01"), new Date("2031-02-02"), propB,
        ),
      ),
    ).rejects.toThrow(); // WITH CHECK rejects the cross-tenant write
  });
});
