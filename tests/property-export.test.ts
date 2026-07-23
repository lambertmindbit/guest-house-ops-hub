import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, unscopedPrisma, __resetTenantResolution } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { exportPropertyData } from "@/lib/property-export";

// GAP-23. The export must be COMPLETE for the acting property and contain NOTHING
// from any other — the tenant scoping is the whole safety story.

const TAG = `pexport-${Date.now()}`;
let propA: string, propB: string;

async function seed(suffix: string) {
  const p = await unscopedPrisma.propertySettings.create({ data: { name: `${TAG}-${suffix}` } });
  await withTenant(p.id, async () => {
    const rt = await prisma.roomType.create({ data: { name: `${TAG}-${suffix}-t`, baseRate: 200000, maxOccupancy: 2, rateFloor: 100000, rateCeiling: 500000 } });
    const [room, guest, channel] = await Promise.all([
      prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-${suffix}-A` } }),
      prisma.guest.create({ data: { name: `Guest ${suffix}`, phone: `${TAG}-${suffix}` } }),
      prisma.channel.create({ data: { name: `${TAG}-${suffix}-c`, commissionPct: 0, collectsPayment: false } }),
    ]);
    const r = await prisma.reservation.create({ data: { roomId: room.id, guestId: guest.id, channelId: channel.id, checkIn: new Date("2031-05-10"), checkOut: new Date("2031-05-12"), grossAmount: 300000 } });
    await prisma.payment.create({ data: { reservationId: r.id, amount: 150000, mode: "cash" } });
    await prisma.expense.create({ data: { date: new Date("2031-05-01"), category: "Supplies", amount: 50000 } });
  });
  return p.id;
}

beforeAll(async () => {
  __resetTenantResolution();
  propA = await seed("A");
  propB = await seed("B");
});

afterAll(async () => {
  for (const pid of [propA, propB]) {
    await unscopedPrisma.payment.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.expense.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.reservation.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.guest.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.room.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.channel.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.roomType.deleteMany({ where: { propertyId: pid } });
    await unscopedPrisma.propertySettings.deleteMany({ where: { id: pid } });
  }
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("exportPropertyData", () => {
  it("exports the acting property's full data set", async () => {
    const data = await withTenant(propA, () => exportPropertyData());
    expect(data.property?.id).toBe(propA);
    expect(data.bookings).toHaveLength(1);
    expect(data.bookings[0].payments).toHaveLength(1); // money trail included
    expect(data.guests).toHaveLength(1);
    expect(data.finance.expenses).toHaveLength(1);
    expect(data.setup.channels).toHaveLength(1);
  });

  it("contains NOTHING from another property (tenant-scoped)", async () => {
    const data = await withTenant(propA, () => exportPropertyData());
    const ids = [
      ...data.bookings.map((r) => r.propertyId),
      ...data.guests.map((g) => g.propertyId),
      ...data.setup.channels.map((c) => c.propertyId),
    ].filter(Boolean);
    expect(ids.every((id) => id === propA)).toBe(true);
    expect(ids).not.toContain(propB);
  });
});
