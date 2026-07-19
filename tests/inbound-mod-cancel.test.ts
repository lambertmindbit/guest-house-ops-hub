import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ingestEmail } from "@/lib/inbound";
import { POST as apply } from "@/app/api/inbound/[id]/apply/route";

// GAP-2: an OTA modification/cancellation matches its booking, stages a linked
// pending change, and Apply updates the booking through the guarded (409) path.
const STAMP = Date.now();
let roomId: string;
let guestId: string;
let channelId: string;

const modEmail = (ref: string, ci: string, co: string) =>
  `Your booking has been modified — Booking.com\nBooking number: ${ref}\nGuest name: Mod Tester\nCheck-in: ${ci}\nCheck-out: ${co}\nTotal price: ₹ 8,000`;
const cancelEmail = (ref: string) =>
  `Your booking has been cancelled — Booking.com\nBooking number: ${ref}\nGuest name: Mod Tester`;

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const post = () => new Request("http://localhost/apply", { method: "POST" });

beforeAll(async () => {
  const rt = await prisma.roomType.create({ data: { name: `modc-${STAMP}-t`, baseRate: 2000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 6000 } });
  const [room, guest, channel] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: rt.id, label: `modc-${STAMP}-A` } }),
    prisma.guest.create({ data: { name: `modc-${STAMP}-g`, phone: `modc-${STAMP}` } }),
    prisma.channel.create({ data: { name: `modc-${STAMP}-c`, commissionPct: 0, collectsPayment: false } }),
  ]);
  roomId = room.id; guestId = guest.id; channelId = channel.id;
});

afterAll(async () => {
  await prisma.inboundBooking.deleteMany({ where: { otaRef: { startsWith: `MODC${STAMP}` } } });
  await prisma.reservation.deleteMany({ where: { guestId } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { name: `modc-${STAMP}-t` } });
  await prisma.channel.deleteMany({ where: { name: `modc-${STAMP}-c` } });
  await prisma.$disconnect();
});

const booking = (ref: string, ci: string, co: string) =>
  prisma.reservation.create({ data: { roomId, guestId, channelId, otaRef: ref, checkIn: new Date(ci), checkOut: new Date(co), grossAmount: 5000 } });

describe("OTA modification/cancellation ingest + apply", () => {
  it("a modification links to the booking as a pending change (not a duplicate)", async () => {
    const ref = `MODC${STAMP}link`;
    const res = await booking(ref, "2027-06-10", "2027-06-12");
    const inbound = await ingestEmail(modEmail(ref, "2027-06-14", "2027-06-17"));
    expect(inbound.emailKind).toBe("modification");
    expect(inbound.reservationId).toBe(res.id);
    expect(inbound.status).toBe("pending");
  });

  it("applying a modification updates the booking's dates and marks it imported", async () => {
    const ref = `MODC${STAMP}apply`;
    const res = await booking(ref, "2027-07-10", "2027-07-12");
    const inbound = await ingestEmail(modEmail(ref, "2027-07-15", "2027-07-18"));
    const applied = await apply(post(), params(inbound.id));
    expect(applied.status).toBe(200);
    const after = await prisma.reservation.findUnique({ where: { id: res.id } });
    expect(after?.checkIn.toISOString().slice(0, 10)).toBe("2027-07-15");
    expect(after?.checkOut.toISOString().slice(0, 10)).toBe("2027-07-18");
    expect((await prisma.inboundBooking.findUnique({ where: { id: inbound.id } }))?.status).toBe("imported");
  });

  it("applying a cancellation cancels the booking and frees the dates", async () => {
    const ref = `MODC${STAMP}cancel`;
    const res = await booking(ref, "2027-08-10", "2027-08-12");
    const inbound = await ingestEmail(cancelEmail(ref));
    expect(inbound.emailKind).toBe("cancellation");
    const applied = await apply(post(), params(inbound.id));
    expect(applied.status).toBe(200);
    expect((await prisma.reservation.findUnique({ where: { id: res.id } }))?.status).toBe("cancelled");
  });

  it("a modification onto dates that clash with another booking is a friendly 409", async () => {
    const ref = `MODC${STAMP}conflict`;
    const target = await booking(ref, "2027-09-10", "2027-09-12");
    await booking(`MODC${STAMP}blocker`, "2027-09-20", "2027-09-25"); // same room, later
    const inbound = await ingestEmail(modEmail(ref, "2027-09-19", "2027-09-22")); // overlaps the blocker
    const applied = await apply(post(), params(inbound.id));
    expect(applied.status).toBe(409);
    // The original booking is untouched.
    expect((await prisma.reservation.findUnique({ where: { id: target.id } }))?.checkIn.toISOString().slice(0, 10)).toBe("2027-09-10");
  });
});
