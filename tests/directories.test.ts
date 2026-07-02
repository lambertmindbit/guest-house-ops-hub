import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import { sharedVendors, sharedDrivers } from "@/lib/community/directories";
import { setGrant } from "@/lib/community/network";

const TAG = `dirs-${Date.now()}`;
let A: string; // owner of the lists
let V: string; // viewer

beforeAll(async () => {
  __resetTenantResolution();
  A = (await prisma.propertySettings.create({ data: { name: `${TAG}-A` } })).id;
  V = (await prisma.propertySettings.create({ data: { name: `${TAG}-V` } })).id;
  await prisma.networkConnection.create({ data: { requesterPropertyId: A, addresseePropertyId: V, status: "accepted" } });

  const adb = prismaForTenant(A);
  await adb.vendor.create({ data: { name: `${TAG}-laundry`, category: "Laundry", contact: "900000", rating: 4, notes: "PRIVATE terms" } });
  await adb.driver.create({ data: { name: `${TAG}-ravi`, phone: "911111", vehicleNumber: "ML05 1", active: true } });
  await adb.driver.create({ data: { name: `${TAG}-inactive`, phone: "922222", active: false } });
});

afterAll(async () => {
  await prisma.vendor.deleteMany({ where: { propertyId: { in: [A, V] } } });
  await prisma.driver.deleteMany({ where: { propertyId: { in: [A, V] } } });
  await prisma.sharingGrant.deleteMany({ where: { grantorPropertyId: { in: [A, V] } } });
  await prisma.networkConnection.deleteMany({ where: { requesterPropertyId: { in: [A, V] } } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: [A, V] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("shared trusted directories", () => {
  it("shares vendors only with a VENDORS grant, and projects no private notes", async () => {
    expect(await sharedVendors(V)).toHaveLength(0);
    await setGrant(A, V, "vendors", true);
    const vendors = await sharedVendors(V);
    expect(vendors).toHaveLength(1);
    expect(vendors[0]).toMatchObject({ name: `${TAG}-laundry`, category: "Laundry", contact: "900000", rating: 4 });
    expect(vendors[0]).not.toHaveProperty("notes");
  });

  it("shares only active drivers with a TRANSPORT grant", async () => {
    expect(await sharedDrivers(V)).toHaveLength(0);
    await setGrant(A, V, "transport", true);
    const drivers = await sharedDrivers(V);
    expect(drivers).toHaveLength(1); // inactive excluded
    expect(drivers[0]).toMatchObject({ name: `${TAG}-ravi`, phone: "911111", vehicleNumber: "ML05 1" });
  });
});
