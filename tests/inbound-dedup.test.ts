import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ingestEmail } from "@/lib/inbound";

// US-305: a re-sent OTA confirmation (matching an existing reservation OR a
// pending/imported staging item by ota_ref) must be flagged `duplicate`, never
// staged as a second pending create. Integration against the real DB.

const STAMP = Date.now();
const REF_NEW = `7731${STAMP}`;
const REF_PENDING = `7712${STAMP}`;
const REF_BOOKED = `7723${STAMP}`;
const ALL_REFS = [REF_NEW, REF_PENDING, REF_BOOKED];

function email(ref: string): string {
  return [
    "Your booking is confirmed — Booking.com",
    `Booking number: ${ref}`,
    "Guest name: Dedup Tester",
    "Phone: +91 98100 55555",
    "Room: Deluxe Double",
    "Check-in: Friday, 12 July 2026",
    "Check-out: Sunday, 14 July 2026",
    "Total price: ₹ 5,000",
  ].join("\n");
}

let roomId: string;
let guestId: string;
let channelId: string;

beforeAll(async () => {
  const roomType = await prisma.roomType.create({ data: { name: `dedup-${STAMP}-t`, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 } });
  const [room, guest, channel] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: roomType.id, label: `dedup-${STAMP}-A` } }),
    prisma.guest.create({ data: { name: `dedup-${STAMP}-g`, phone: `dedup-${STAMP}` } }),
    prisma.channel.create({ data: { name: `dedup-${STAMP}-c`, commissionPct: 0, collectsPayment: false } }),
  ]);
  roomId = room.id; guestId = guest.id; channelId = channel.id;
  // A booking that already carries REF_BOOKED (scenario: OTA re-sends its confirmation).
  await prisma.reservation.create({
    data: { roomId, guestId, channelId, otaRef: REF_BOOKED, checkIn: new Date("2026-07-12"), checkOut: new Date("2026-07-14") },
  });
});

afterAll(async () => {
  await prisma.inboundBooking.deleteMany({ where: { otaRef: { in: ALL_REFS } } });
  await prisma.reservation.deleteMany({ where: { guestId } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { name: `dedup-${STAMP}-t` } });
  await prisma.channel.deleteMany({ where: { name: `dedup-${STAMP}-c` } });
  await prisma.$disconnect();
});

describe("ingestEmail dedup (US-305)", () => {
  it("stages a genuinely new confirmation as pending", async () => {
    const r = await ingestEmail(email(REF_NEW));
    expect(r.status).toBe("pending");
    expect(r.otaRef).toBe(REF_NEW);
  });

  it("flags a re-send of a pending item as duplicate, without a second pending", async () => {
    const first = await ingestEmail(email(REF_PENDING));
    expect(first.status).toBe("pending");
    const second = await ingestEmail(email(REF_PENDING));
    expect(second.status).toBe("duplicate");

    const pending = await prisma.inboundBooking.count({ where: { otaRef: REF_PENDING, status: "pending" } });
    expect(pending).toBe(1); // no new pending create
  });

  it("flags a confirmation whose ota_ref already belongs to a booking as duplicate", async () => {
    const r = await ingestEmail(email(REF_BOOKED));
    expect(r.status).toBe("duplicate");
    const pending = await prisma.inboundBooking.count({ where: { otaRef: REF_BOOKED, status: "pending" } });
    expect(pending).toBe(0); // never staged for review
  });

  it("does not pile up duplicate rows on repeated retries", async () => {
    const a = await ingestEmail(email(REF_BOOKED));
    const b = await ingestEmail(email(REF_BOOKED));
    expect(b.id).toBe(a.id); // same duplicate row returned
    const dups = await prisma.inboundBooking.count({ where: { otaRef: REF_BOOKED, status: "duplicate" } });
    expect(dups).toBe(1);
  });
});
