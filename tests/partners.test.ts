import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaForTenant, prisma, __resetTenantResolution } from "@/lib/prisma";
import { referralSummary } from "@/lib/partners";

// ─── Pure referral summary ──────────────────────────────────────────────────

describe("referralSummary", () => {
  it("counts by status and rates conversion over decided referrals only", () => {
    const s = referralSummary([
      { status: "booked" },
      { status: "booked" },
      { status: "declined" },
      { status: "referred" }, // pending — excluded from the rate
    ]);
    expect(s).toEqual({ total: 4, referred: 1, booked: 2, declined: 1, conversionRate: 2 / 3 });
  });

  it("reports a zero rate when nothing has been decided yet", () => {
    const s = referralSummary([{ status: "referred" }]);
    expect(s.conversionRate).toBe(0);
  });
});

// ─── DB CRUD + tenant scoping ───────────────────────────────────────────────

const TAG = `partners-${Date.now()}`;
let A: string;
let B: string;

beforeAll(async () => {
  __resetTenantResolution();
  A = (await prisma.propertySettings.create({ data: { name: `${TAG}-A` } })).id;
  B = (await prisma.propertySettings.create({ data: { name: `${TAG}-B` } })).id;
});

afterAll(async () => {
  for (const p of [A, B]) {
    await prisma.outboundReferral.deleteMany({ where: { propertyId: p } });
    await prisma.partner.deleteMany({ where: { propertyId: p } });
  }
  await prisma.propertySettings.deleteMany({ where: { id: { in: [A, B] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("partners & referrals are tenant-scoped", () => {
  it("a partner and referral created for A are not visible to B", async () => {
    const adb = prismaForTenant(A);
    const partner = await adb.partner.create({ data: { name: `${TAG}-driver`, kind: "driver" } });
    await adb.outboundReferral.create({ data: { guestName: `${TAG}-guest`, partnerId: partner.id, status: "booked" } });

    const aPartners = await adb.partner.findMany();
    expect(aPartners.some((p) => p.name === `${TAG}-driver`)).toBe(true);
    expect(aPartners.every((p) => p.propertyId === A)).toBe(true);

    const aReferrals = await adb.outboundReferral.findMany();
    expect(aReferrals.every((r) => r.propertyId === A)).toBe(true);

    const bdb = prismaForTenant(B);
    expect((await bdb.partner.findMany()).some((p) => p.name === `${TAG}-driver`)).toBe(false);
    expect((await bdb.outboundReferral.findMany()).some((r) => r.guestName === `${TAG}-guest`)).toBe(false);
  });
});
