import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, __resetTenantResolution } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";

// Tenant isolation: two properties, a room in each. A read/write in property A's
// context must never see property B's rows — and writes auto-stamp the tenant.

const A = `tenantA-${Date.now()}`;
const B = `tenantB-${Date.now()}`;
let propA: string;
let propB: string;

const rt = (name: string) => ({ name, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 });

beforeAll(async () => {
  __resetTenantResolution();
  // PropertySettings is the tenant root (not scoped), so create directly.
  propA = (await prisma.propertySettings.create({ data: { name: A } })).id;
  propB = (await prisma.propertySettings.create({ data: { name: B } })).id;

  const rtA = await withTenant(propA, () => prisma.roomType.create({ data: rt(`${A}-t`) }));
  const rtB = await withTenant(propB, () => prisma.roomType.create({ data: rt(`${B}-t`) }));
  await withTenant(propA, () => prisma.room.create({ data: { roomTypeId: rtA.id, label: `${A}-101` } }));
  await withTenant(propB, () => prisma.room.create({ data: { roomTypeId: rtB.id, label: `${B}-101` } }));
});

afterAll(async () => {
  // 2 properties + no context → passthrough, so the explicit where applies.
  await prisma.room.deleteMany({ where: { propertyId: { in: [propA, propB] } } });
  await prisma.roomType.deleteMany({ where: { propertyId: { in: [propA, propB] } } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: [propA, propB] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("tenant isolation", () => {
  it("scopes reads to the active property and auto-stamps writes", async () => {
    const aRooms = await withTenant(propA, () => prisma.room.findMany());
    expect(aRooms.length).toBeGreaterThan(0);
    expect(aRooms.every((r) => r.propertyId === propA)).toBe(true);
    expect(aRooms.some((r) => r.label === `${A}-101`)).toBe(true);
    expect(aRooms.some((r) => r.label === `${B}-101`)).toBe(false);

    const bRooms = await withTenant(propB, () => prisma.room.findMany());
    expect(bRooms.every((r) => r.propertyId === propB)).toBe(true);
    expect(bRooms.some((r) => r.label === `${A}-101`)).toBe(false);
  });

  it("scopes findUnique by tenant (extendedWhereUnique)", async () => {
    const bRoom = (await withTenant(propB, () => prisma.room.findMany()))[0];
    const seenFromA = await withTenant(propA, () => prisma.room.findUnique({ where: { id: bRoom.id } }));
    expect(seenFromA).toBeNull(); // A cannot read B's row by id
    const seenFromB = await withTenant(propB, () => prisma.room.findUnique({ where: { id: bRoom.id } }));
    expect(seenFromB?.id).toBe(bRoom.id);
  });
});
