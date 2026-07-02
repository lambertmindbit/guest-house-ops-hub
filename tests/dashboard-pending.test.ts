import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import { getPendingPayments, sumOutstanding } from "@/lib/finance";

// The Today dashboard's pending-payments card shows getPendingPayments().total.
// This proves that figure matches sumOutstanding over the underlying bookings:
// seed a known confirmed booking with a partial payment and assert the delta.

const TAG = `pend-${Date.now()}`;
let P: string;
let roomId: string;
let guestId: string;
let channelId: string;
let reservationId: string;

beforeAll(async () => {
  __resetTenantResolution();
  // Two properties guarantee the default client runs in passthrough (whole-DB)
  // mode, so getPendingPayments aggregates the seeded booking deterministically.
  P = (await prisma.propertySettings.create({ data: { name: `${TAG}-P` } })).id;
  await prisma.propertySettings.create({ data: { name: `${TAG}-Q` } });

  const db = prismaForTenant(P);
  const rt = await db.roomType.create({ data: { name: `${TAG}-t`, baseRate: 5000, maxOccupancy: 2, rateFloor: 1000, rateCeiling: 9000 } });
  roomId = (await db.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-1` } })).id;
  guestId = (await db.guest.create({ data: { name: `${TAG}-g`, phone: TAG } })).id;
  channelId = (await db.channel.create({ data: { name: `${TAG}-c`, commissionPct: 0, collectsPayment: false } })).id;
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { reservationId } });
  await prisma.reservation.deleteMany({ where: { id: reservationId } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.room.deleteMany({ where: { propertyId: P } });
  await prisma.roomType.deleteMany({ where: { propertyId: P } });
  await prisma.propertySettings.deleteMany({ where: { name: { in: [`${TAG}-P`, `${TAG}-Q`] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("dashboard pending-payments card total", () => {
  it("matches sumOutstanding for the seeded booking", async () => {
    const before = await getPendingPayments();

    const db = prismaForTenant(P);
    reservationId = (await db.reservation.create({
      data: { roomId, guestId, channelId, checkIn: new Date("2026-09-01"), checkOut: new Date("2026-09-03"), grossAmount: 5000 },
    })).id;
    await db.payment.create({ data: { reservationId, amount: 2000, mode: "cash" } });

    const after = await getPendingPayments();
    const expected = sumOutstanding([{ grossAmount: 5000, collected: 2000, status: "confirmed" }]); // { total: 3000, count: 1 }

    expect(after.total - before.total).toBe(expected.total);
    expect(after.count - before.count).toBe(expected.count);
  });
});
