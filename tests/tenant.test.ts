import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import { freeRooms } from "@/lib/availability";
import { disabledModules } from "@/lib/module-gate";
import { currentPropertySettings } from "@/lib/property-settings";

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

  // Module visibility is per property, so a client with two guest houses can buy
  // Inventory for one and not the other.
  //
  // This test earned its keep immediately: the first implementation read the row
  // with propertySettings.findFirst(), which LOOKS tenant-scoped and is not —
  // PropertySettings is the tenant ROOT and is absent from TENANT_MODELS, so
  // findFirst() returns whichever row comes first. It passed with one property and
  // would have silently applied one guest house's module list to the other.
  it("module toggles are per property, not per database", async () => {
    await prisma.propertySettings.update({
      where: { id: propA },
      data: { disabledModules: ["inventory", "vendors"] },
    });

    // Exercise the real helper, not a hand-rolled read — a hand-rolled read is
    // precisely what was wrong.
    const a = await disabledModules(propA);
    const b = await disabledModules(propB);

    expect([...a].sort()).toEqual(["inventory", "vendors"]);
    expect([...b]).toEqual([]); // untouched — and empty means "show everything"
  });

  // freeRooms() is RAW SQL, and the tenant extension cannot see raw SQL — it only
  // intercepts model operations. So this query has to filter property_id itself,
  // and until 2026-07-14 it did not: it returned every room in the DATABASE.
  //
  // Not a cosmetic leak. freeRooms backs the owner's booking-form room picker AND
  // the AI agent's availability tool, so a second property would have been offered
  // the first one's rooms as bookable — and a booking written against a room owned
  // by another property would NOT be caught by the GiST exclusion constraint,
  // which is keyed per room, not per property.
  // PropertySettings is the tenant ROOT — not auto-scoped — so a bare findFirst()
  // returns whichever property comes first, not the acting one. That drove the
  // invoice GSTIN, pricing config and booking ID-policy off the wrong property in a
  // multi-property setup. currentPropertySettings() must resolve by the acting id.
  it("currentPropertySettings() returns the acting property's row, not the first", async () => {
    await prisma.propertySettings.update({ where: { id: propA }, data: { gstNumber: "GST-A" } });
    await prisma.propertySettings.update({ where: { id: propB }, data: { gstNumber: "GST-B" } });

    const a = await currentPropertySettings(propA);
    const b = await currentPropertySettings(propB);

    expect(a?.id).toBe(propA);
    expect(a?.gstNumber).toBe("GST-A");
    expect(b?.id).toBe(propB);
    expect(b?.gstNumber).toBe("GST-B");
  });

  // Guests are SHARED across the owner's properties (unified CRM) — Guest was taken
  // out of TENANT_MODELS. This proves both halves: a guest created while acting as
  // property A is visible from property B, AND an upsert-by-phone from B reuses that
  // record instead of colliding on the global-unique phone. The second half is the
  // dedup bug the old scoped model caused: B couldn't see A's guest, so it tried to
  // create one and hit the unique constraint.
  it("guests are shared across properties, and dedup by phone works across them", async () => {
    const phone = `88${Date.now()}`.slice(0, 12);
    await prismaForTenant(propA).guest.create({ data: { name: "Priya", phone } });

    const seenFromB = await prismaForTenant(propB).guest.findUnique({ where: { phone } });
    expect(seenFromB?.name).toBe("Priya"); // shared: B sees A's guest

    const upserted = await prismaForTenant(propB).guest.upsert({
      where: { phone },
      update: { name: "Priya Nair" },
      create: { name: "SHOULD-NOT-CREATE", phone },
    });
    expect(upserted.name).toBe("Priya Nair"); // reused + updated, did not duplicate
    expect(await prisma.guest.count({ where: { phone } })).toBe(1);

    await prisma.guest.deleteMany({ where: { phone } });
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
