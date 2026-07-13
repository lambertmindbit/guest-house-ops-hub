import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import { notifyPreArrival, notifyPaymentReminder, logMessage, setMessageAdapter, LogAdapter } from "@/lib/messaging";
import { todayDateOnly, addDays, parseDateOnly } from "@/lib/dates";

const TAG = `msg-${Date.now()}`;
let P: string;
let guestId: string;
let channelId: string;
let roomId: string;
let r1: string; // arrives tomorrow, ₹4000 unpaid
let r2: string; // fully paid

beforeAll(async () => {
  __resetTenantResolution();
  P = (await prisma.propertySettings.create({ data: { name: `${TAG}-P`, upiVpa: "lawei@okhdfcbank" } })).id;
  const db = prismaForTenant(P);
  const rt = await db.roomType.create({ data: { name: `${TAG}-t`, baseRate: 4000, maxOccupancy: 2, rateFloor: 1000, rateCeiling: 8000 } });
  roomId = (await db.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-1` } })).id;
  guestId = (await db.guest.create({ data: { name: `${TAG}-g`, phone: TAG } })).id;
  channelId = (await db.channel.create({ data: { name: `${TAG}-c`, commissionPct: 0, collectsPayment: false } })).id;

  const today = todayDateOnly();
  r1 = (await db.reservation.create({ data: { roomId, guestId, channelId, checkIn: parseDateOnly(addDays(today, 1)), checkOut: parseDateOnly(addDays(today, 2)), grossAmount: 4000 } })).id;
  const rt2 = await db.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-2` } });
  r2 = (await db.reservation.create({ data: { roomId: rt2.id, guestId, channelId, checkIn: parseDateOnly(addDays(today, 2)), checkOut: parseDateOnly(addDays(today, 3)), grossAmount: 3000 } })).id;
  await db.payment.create({ data: { reservationId: r2, amount: 3000, mode: "upi" } });
});

afterAll(async () => {
  setMessageAdapter(LogAdapter);
  await prisma.outboundMessage.deleteMany({ where: { reservationId: { in: [r1, r2] } } });
  await prisma.payment.deleteMany({ where: { reservationId: { in: [r1, r2] } } });
  await prisma.reservation.deleteMany({ where: { id: { in: [r1, r2] } } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.room.deleteMany({ where: { propertyId: P } });
  await prisma.roomType.deleteMany({ where: { propertyId: P } });
  await prisma.propertySettings.deleteMany({ where: { id: P } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

async function count(reservationId: string, template: string) {
  return prisma.outboundMessage.count({ where: { reservationId, template } });
}

describe("messaging triggers", () => {
  it("enqueues pre-arrival once (idempotent)", async () => {
    expect(await notifyPreArrival(r1)).not.toBeNull();
    expect(await notifyPreArrival(r1)).toBeNull(); // dedup
    expect(await count(r1, "preArrivalDirections")).toBe(1);
  });

  it("enqueues a payment reminder only when a balance is due", async () => {
    expect(await notifyPaymentReminder(r1)).not.toBeNull(); // ₹4000 due
    expect(await notifyPaymentReminder(r1)).toBeNull(); // dedup
    expect(await count(r1, "paymentReminder")).toBe(1);

    expect(await notifyPaymentReminder(r2)).toBeNull(); // fully paid → nothing
    expect(await count(r2, "paymentReminder")).toBe(0);
  });

  it("routes status through the active adapter (BSP-ready seam)", async () => {
    setMessageAdapter({ name: "fake", async send() { return { status: "sent", sentAt: new Date() }; } });
    const msg = await logMessage({ source: "system", channel: "whatsapp", to: TAG, body: "hi", reservationId: r1, template: "bookingConfirmation" });
    expect(msg?.status).toBe("sent");
    setMessageAdapter(LogAdapter);
    const logged = await logMessage({ source: "system", channel: "whatsapp", to: TAG, body: "hi", reservationId: r1 });
    expect(logged?.status).toBe("logged");
  });
});
