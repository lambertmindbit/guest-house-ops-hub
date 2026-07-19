import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as addPayment } from "@/app/api/reservations/[id]/payments/route";

// Regression for the overpayment gap: the fat-finger guard must consider
// payments ALREADY on the booking, not just the single amount — two payments
// that together exceed the total are rejected.

const TAG = `overpay-${Date.now()}`;
let reservationId = "";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function post(body: unknown) {
  return new Request("http://localhost/api/reservations/x/payments", { method: "POST", body: JSON.stringify(body) });
}

beforeAll(async () => {
  const rt = await prisma.roomType.create({ data: { name: `${TAG}-type`, baseRate: 2000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 5000 } });
  const room = await prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-201` } });
  const channel = await prisma.channel.create({ data: { name: `${TAG}-ch`, commissionPct: 0, collectsPayment: false } });
  const guest = await prisma.guest.create({ data: { name: `${TAG}-guest`, phone: `${TAG}` } });
  const r = await prisma.reservation.create({
    data: {
      roomId: room.id, guestId: guest.id, channelId: channel.id,
      checkIn: new Date("2031-06-10"), checkOut: new Date("2031-06-12"), grossAmount: 200000,
    },
  });
  reservationId = r.id;
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { reservationId } });
  await prisma.reservation.deleteMany({ where: { id: reservationId } });
  await prisma.guest.deleteMany({ where: { phone: TAG } });
  await prisma.channel.deleteMany({ where: { name: `${TAG}-ch` } });
  await prisma.room.deleteMany({ where: { label: `${TAG}-201` } });
  await prisma.roomType.deleteMany({ where: { name: `${TAG}-type` } });
  await prisma.$disconnect();
});

describe("POST /api/reservations/[id]/payments — overpayment guard", () => {
  it("accepts a partial payment", async () => {
    const res = await addPayment(post({ amount: 150000, mode: "cash" }), ctx(reservationId));
    expect(res.status).toBe(201);
  });

  it("rejects a second payment that would exceed the total", async () => {
    // ₹1500 already collected on a ₹2000 booking; ₹1500 more would make ₹3000 (paise).
    const res = await addPayment(post({ amount: 150000, mode: "upi" }), ctx(reservationId));
    expect(res.status).toBe(422);
    const { error } = await res.json();
    expect(error).toContain("500"); // only ₹500 outstanding
  });

  it("accepts a payment that exactly settles the balance", async () => {
    const res = await addPayment(post({ amount: 50000, mode: "upi" }), ctx(reservationId));
    expect(res.status).toBe(201);
  });
});
