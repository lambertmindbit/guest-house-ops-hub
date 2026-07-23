import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, __resetTenantResolution } from "@/lib/prisma";
import { bookableUnits, getAvailability } from "@/lib/availability";

describe("bookableUnits (pure)", () => {
  it("subtracts the buffer, never below zero", () => {
    expect(bookableUnits(5, 2)).toBe(3);
    expect(bookableUnits(1, 2)).toBe(0); // buffer larger than what's free → nothing to advertise
    expect(bookableUnits(3, 0)).toBe(3); // no buffer = unchanged
  });
});

describe("getAvailability honours the oversell buffer (GAP-24)", () => {
  const TAG = `oversell-${Date.now()}`;
  let rtId: string;

  beforeAll(async () => {
    __resetTenantResolution();
    const rt = await prisma.roomType.create({
      data: { name: `${TAG}-t`, baseRate: 200000, maxOccupancy: 2, rateFloor: 100000, rateCeiling: 500000, oversellBuffer: 1 },
    });
    rtId = rt.id;
    await Promise.all([
      prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-A` } }),
      prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-B` } }),
      prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-C` } }),
    ]);
  });

  afterAll(async () => {
    await prisma.room.deleteMany({ where: { roomTypeId: rtId } });
    await prisma.roomType.deleteMany({ where: { id: rtId } });
    __resetTenantResolution();
    await prisma.$disconnect();
  });

  it("reports bookable = physical available − buffer (3 rooms, buffer 1 → 2 bookable)", async () => {
    const nights = await getAvailability(rtId, "2031-06-10", "2031-06-11");
    expect(nights).toHaveLength(1);
    const n = nights[0];
    expect(n.total).toBe(3);
    expect(n.available).toBe(3); // physical, unchanged (pricing/occupancy still uses this)
    expect(n.buffer).toBe(1);
    expect(n.bookable).toBe(2); // advertised to agent/network — the margin is held back
  });
});
