import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaForTenant, prisma, __resetTenantResolution } from "@/lib/prisma";
import { commissionSummary } from "@/lib/tours";

// ─── Pure commission summary ────────────────────────────────────────────────

describe("commissionSummary", () => {
  it("sums realised bookings and per-booking commission, skipping cancelled", () => {
    const s = commissionSummary([
      { amount: 2000, commissionPct: 10, status: "completed" }, // rev 2000, comm 200
      { amount: 1000, commissionPct: 0, status: "confirmed" },  // rev 1000, comm 0
      { amount: 5000, commissionPct: 20, status: "cancelled" }, // skipped
      { amount: null, commissionPct: 10, status: "planned" },   // rev 0, comm 0, counts
    ]);
    expect(s).toEqual({ bookings: 3, revenue: 3000, commission: 200 });
  });
});

// ─── DB CRUD + tenant scoping ───────────────────────────────────────────────

const TAG = `tours-${Date.now()}`;
let A: string;
let B: string;

beforeAll(async () => {
  __resetTenantResolution();
  A = (await prisma.propertySettings.create({ data: { name: `${TAG}-A` } })).id;
  B = (await prisma.propertySettings.create({ data: { name: `${TAG}-B` } })).id;
});

afterAll(async () => {
  for (const p of [A, B]) {
    await prisma.tourBooking.deleteMany({ where: { propertyId: p } });
    await prisma.tour.deleteMany({ where: { propertyId: p } });
    await prisma.tourPartner.deleteMany({ where: { propertyId: p } });
  }
  await prisma.propertySettings.deleteMany({ where: { id: { in: [A, B] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("tours are tenant-scoped", () => {
  it("a tour created for A is not visible to B", async () => {
    const adb = prismaForTenant(A);
    const partner = await adb.tourPartner.create({ data: { name: `${TAG}-guide`, commissionPct: 15 } });
    await adb.tour.create({ data: { name: `${TAG}-trek`, price: 1500, partnerId: partner.id } });

    const aTours = await adb.tour.findMany();
    expect(aTours.some((t) => t.name === `${TAG}-trek`)).toBe(true);
    expect(aTours.every((t) => t.propertyId === A)).toBe(true);

    const bTours = await prismaForTenant(B).tour.findMany();
    expect(bTours.some((t) => t.name === `${TAG}-trek`)).toBe(false);
  });
});
