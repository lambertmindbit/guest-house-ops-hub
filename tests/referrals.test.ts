import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import {
  creditBalanceFrom, analyticsFrom, proposeReferral, respondToReferral,
  convertReferral, listReferrals, creditBalances,
} from "@/lib/community/referrals";
import { setGrant } from "@/lib/community/network";

// ─── Pure helpers ───────────────────────────────────────────────────────────

describe("creditBalanceFrom", () => {
  it("nets ledger entries from my perspective (positive = peer owes me)", () => {
    const entries = [
      { fromPropertyId: "A", toPropertyId: "B", amount: 100 },
      { fromPropertyId: "B", toPropertyId: "A", amount: 30 },
    ];
    expect(creditBalanceFrom(entries, "A", "B")).toBe(70);
    expect(creditBalanceFrom(entries, "B", "A")).toBe(-70);
  });
});

describe("analyticsFrom", () => {
  it("summarizes outbound referrals", () => {
    const a = analyticsFrom([
      { status: "converted", attributedRevenue: 100 },
      { status: "accepted", attributedRevenue: null },
      { status: "declined", attributedRevenue: null },
      { status: "proposed", attributedRevenue: null },
    ]);
    expect(a).toEqual({ sent: 4, accepted: 2, converted: 1, declined: 1, conversionRate: 0.25, revenueEarned: 100 });
  });
});

// ─── DB flow ────────────────────────────────────────────────────────────────

const TAG = `ref-${Date.now()}`;
let A: string; // referrer (sender)
let B: string; // recipient
let bRoom: string;
let bGuest: string;
let bChannel: string;
let aReservation: string;
let referralId: string;

beforeAll(async () => {
  __resetTenantResolution();
  A = (await prisma.propertySettings.create({ data: { name: `${TAG}-A` } })).id;
  B = (await prisma.propertySettings.create({ data: { name: `${TAG}-B` } })).id;
  await prisma.networkConnection.create({ data: { requesterPropertyId: A, addresseePropertyId: B, status: "accepted" } });

  const bdb = prismaForTenant(B);
  const rt = await bdb.roomType.create({ data: { name: `${TAG}-t`, baseRate: 2500, maxOccupancy: 2, rateFloor: 1000, rateCeiling: 5000 } });
  bRoom = (await bdb.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-b1` } })).id;
  bGuest = (await bdb.guest.create({ data: { name: `${TAG}-g`, phone: `${TAG}-b` } })).id;
  bChannel = (await bdb.channel.create({ data: { name: `${TAG}-c`, commissionPct: 0, collectsPayment: false } })).id;

  // A reservation that belongs to A (used to prove convert rejects a non-owned booking).
  const adb = prismaForTenant(A);
  const art = await adb.roomType.create({ data: { name: `${TAG}-at`, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 } });
  const aRoom = await adb.room.create({ data: { roomTypeId: art.id, label: `${TAG}-a1` } });
  const aGuest = await adb.guest.create({ data: { name: `${TAG}-ag`, phone: `${TAG}-a` } });
  const aChannel = await adb.channel.create({ data: { name: `${TAG}-ac`, commissionPct: 0, collectsPayment: false } });
  aReservation = (await adb.reservation.create({ data: { roomId: aRoom.id, guestId: aGuest.id, channelId: aChannel.id, checkIn: new Date("2026-10-01"), checkOut: new Date("2026-10-02") } })).id;
});

afterAll(async () => {
  await prisma.referralCreditEntry.deleteMany({ where: { fromPropertyId: { in: [A, B] } } });
  await prisma.referral.deleteMany({ where: { fromPropertyId: { in: [A, B] } } });
  await prisma.reservation.deleteMany({ where: { propertyId: { in: [A, B] } } });
  await prisma.guest.deleteMany({ where: { propertyId: { in: [A, B] } } });
  await prisma.channel.deleteMany({ where: { propertyId: { in: [A, B] } } });
  await prisma.room.deleteMany({ where: { propertyId: { in: [A, B] } } });
  await prisma.roomType.deleteMany({ where: { propertyId: { in: [A, B] } } });
  await prisma.sharingGrant.deleteMany({ where: { grantorPropertyId: { in: [A, B] } } });
  await prisma.networkConnection.deleteMany({ where: { requesterPropertyId: { in: [A, B] } } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: [A, B] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("referral flow", () => {
  const input = { guestName: "Riya", guestPhone: "9998887777", checkIn: "2026-11-10", checkOut: "2026-11-12", roomTypeNeed: "double" };

  it("blocks a referral until the recipient accepts referrals from the sender", async () => {
    const blocked = await proposeReferral(A, B, input);
    expect(blocked.ok).toBe(false);
    await setGrant(B, A, "referrals", true);
    const okd = await proposeReferral(A, B, input);
    expect(okd.ok).toBe(true);
    referralId = okd.ok ? okd.referralId : "";
  });

  it("withholds the guest phone from the recipient until accepted (data minimisation)", async () => {
    const inboundBefore = (await listReferrals(B)).find((r) => r.id === referralId)!;
    expect(inboundBefore.guestPhone).toBeNull();

    await respondToReferral(referralId, B, true);
    const inboundAfter = (await listReferrals(B)).find((r) => r.id === referralId)!;
    expect(inboundAfter.guestPhone).toBe("9998887777");
  });

  it("cannot attribute a booking that isn't the recipient's", async () => {
    const bad = await convertReferral(referralId, B, aReservation);
    expect(bad.ok).toBe(false);
  });

  it("links a real booking → converted + derived reciprocal credit", async () => {
    // The recipient books the guest the NORMAL guarded way.
    const reservation = await prismaForTenant(B).reservation.create({
      data: { roomId: bRoom, guestId: bGuest, channelId: bChannel, checkIn: new Date("2026-11-10"), checkOut: new Date("2026-11-12"), grossAmount: 4000 },
    });
    const res = await convertReferral(referralId, B, reservation.id);
    expect(res.ok).toBe(true);

    const converted = (await listReferrals(B)).find((r) => r.id === referralId)!;
    expect(converted.status).toBe("converted");
    expect(converted.attributedRevenue).toBe(4000);

    // Derived balances: B owes A 4000 (A sent the converting business).
    expect((await creditBalances(A)).find((b) => b.peerPropertyId === B)!.balance).toBe(4000);
    expect((await creditBalances(B)).find((b) => b.peerPropertyId === A)!.balance).toBe(-4000);
  });
});
