import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import { freeRooms } from "@/lib/availability";

// Tenant isolation: two properties, a room in each. A read/write bound to
// property A must never see property B's rows — and writes auto-stamp the tenant.

const A = `tenantA-${Date.now()}`;
const B = `tenantB-${Date.now()}`;
let propA: string;
let propB: string;

const rt = (name: string) => ({ name, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 });

beforeAll(async () => {
  __resetTenantResolution();
  // PropertySettings is the tenant root (not scoped), so create via the default client.
  propA = (await prisma.propertySettings.create({ data: { name: A } })).id;
  propB = (await prisma.propertySettings.create({ data: { name: B } })).id;

  const a = prismaForTenant(propA);
  const b = prismaForTenant(propB);
  const rtA = await a.roomType.create({ data: rt(`${A}-t`) });
  const rtB = await b.roomType.create({ data: rt(`${B}-t`) });
  await a.room.create({ data: { roomTypeId: rtA.id, label: `${A}-101` } });
  await b.room.create({ data: { roomTypeId: rtB.id, label: `${B}-101` } });
});

afterAll(async () => {
  // 2 properties + default client → passthrough, so the explicit where applies.
  await prisma.room.deleteMany({ where: { propertyId: { in: [propA, propB] } } });
  await prisma.roomType.deleteMany({ where: { propertyId: { in: [propA, propB] } } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: [propA, propB] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("tenant isolation", () => {
  it("scopes reads to the bound property and auto-stamps writes", async () => {
    const aRooms = await prismaForTenant(propA).room.findMany();
    expect(aRooms.length).toBeGreaterThan(0);
    expect(aRooms.every((r) => r.propertyId === propA)).toBe(true);
    expect(aRooms.some((r) => r.label === `${A}-101`)).toBe(true);
    expect(aRooms.some((r) => r.label === `${B}-101`)).toBe(false);

    const bRooms = await prismaForTenant(propB).room.findMany();
    expect(bRooms.every((r) => r.propertyId === propB)).toBe(true);
    expect(bRooms.some((r) => r.label === `${A}-101`)).toBe(false);
  });

  it("scopes findUnique by tenant (extendedWhereUnique)", async () => {
    const bRoom = (await prismaForTenant(propB).room.findMany())[0];
    const seenFromA = await prismaForTenant(propA).room.findUnique({ where: { id: bRoom.id } });
    expect(seenFromA).toBeNull(); // A cannot read B's row by id
    const seenFromB = await prismaForTenant(propB).room.findUnique({ where: { id: bRoom.id } });
    expect(seenFromB?.id).toBe(bRoom.id);
  });

  // freeRooms() is RAW SQL, and the tenant extension cannot see raw SQL — it only
  // intercepts model operations. So this query has to filter property_id itself,
  // and until 2026-07-14 it did not: it returned every room in the DATABASE.
  //
  // That is not a cosmetic leak. freeRooms backs the owner's booking-form room
  // picker AND the AI agent's availability tool, so a second property would have
  // been offered the first one's rooms as bookable — and a booking written against
  // a room owned by another property would NOT be caught by the GiST exclusion
  // constraint, which is keyed per room, not per property.
  // Module visibility is per property, so a client with two guest houses can buy
  // Inventory for one and not the other. If this read were not tenant-scoped, the
  // vendor's switch on one property would silently reshape the other one's app.
  it("module toggles are per property, not per database", async () => {
    await prisma.propertySettings.update({
      where: { id: propA },
      data: { disabledModules: ["inventory", "vendors"] },
    });

    const a = await prismaForTenant(propA).propertySettings.findFirst({ select: { disabledModules: true } });
    const b = await prismaForTenant(propB).propertySettings.findFirst({ select: { disabledModules: true } });

    expect(a?.disabledModules.sort()).toEqual(["inventory", "vendors"]);
    expect(b?.disabledModules).toEqual([]); // untouched — and empty means "show everything"
  });

  it("freeRooms() returns only the bound property's rooms (raw SQL is not auto-scoped)", async () => {
    const checkIn = "2031-03-01";
    const checkOut = "2031-03-03";

    const forA = await freeRooms(checkIn, checkOut, "", propA);
    expect(forA.length).toBeGreaterThan(0);
    expect(forA.some((r) => r.label === `${A}-101`)).toBe(true);
    expect(forA.some((r) => r.label === `${B}-101`)).toBe(false); // ← the bug

    const forB = await freeRooms(checkIn, checkOut, "", propB);
    expect(forB.some((r) => r.label === `${B}-101`)).toBe(true);
    expect(forB.some((r) => r.label === `${A}-101`)).toBe(false);

    // Every row must actually belong to the property that asked for it.
    const aIds = new Set((await prismaForTenant(propA).room.findMany()).map((r) => r.id));
    expect(forA.every((r) => aIds.has(r.id))).toBe(true);
  });
});
