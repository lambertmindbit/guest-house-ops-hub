import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getAvailability } from "@/lib/availability";

// Proves availability is correctly DERIVED from confirmed reservations + blocks.
// A 2-room type, observed over the nights of 9..13 Sept 2026.

const TAG = `test-avail-${Date.now()}`;
let roomTypeId: string;
let roomA: string;
let roomB: string;
let guestId: string;
let channelId: string;

const FROM = "2026-09-09";
const TO = "2026-09-14"; // nights: 09,10,11,12,13

async function avail(): Promise<Record<string, number>> {
  const nights = await getAvailability(roomTypeId, FROM, TO);
  return Object.fromEntries(nights.map((n) => [n.date, n.available]));
}

beforeAll(async () => {
  const roomType = await prisma.roomType.create({
    data: { name: `${TAG}-type`, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 },
  });
  roomTypeId = roomType.id;
  const [a, b] = await Promise.all([
    prisma.room.create({ data: { roomTypeId, label: `${TAG}-A` } }),
    prisma.room.create({ data: { roomTypeId, label: `${TAG}-B` } }),
  ]);
  roomA = a.id;
  roomB = b.id;
  guestId = (await prisma.guest.create({ data: { name: `${TAG}-g`, phone: TAG } })).id;
  channelId = (
    await prisma.channel.create({ data: { name: `${TAG}-c`, commissionPct: 0, collectsPayment: false } })
  ).id;
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { roomId: { in: [roomA, roomB] } } });
  await prisma.block.deleteMany({ where: { roomId: { in: [roomA, roomB] } } });
  await prisma.guest.deleteMany({ where: { phone: TAG } });
  await prisma.room.deleteMany({ where: { id: { in: [roomA, roomB] } } });
  await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.$disconnect();
});

describe("derived availability", () => {
  it("reports full availability when nothing is booked", async () => {
    const a = await avail();
    for (const date of ["2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"]) {
      expect(a[date]).toBe(2);
    }
  });

  it("a confirmed reservation reduces availability only on its nights", async () => {
    // Stay 10..13 → occupies nights 10, 11, 12 (checkout day 13 is free again).
    await prisma.reservation.create({
      data: { roomId: roomA, guestId, channelId, checkIn: new Date("2026-09-10"), checkOut: new Date("2026-09-13") },
    });
    const a = await avail();
    expect(a["2026-09-09"]).toBe(2);
    expect(a["2026-09-10"]).toBe(1);
    expect(a["2026-09-11"]).toBe(1);
    expect(a["2026-09-12"]).toBe(1);
    expect(a["2026-09-13"]).toBe(2); // same-day turnover: checkout night is open
  });

  it("a block reduces availability too", async () => {
    // Block room B on night 11 → both rooms occupied that night → 0 available.
    await prisma.block.create({
      data: { roomId: roomB, startDate: new Date("2026-09-11"), endDate: new Date("2026-09-12"), reason: "maintenance" },
    });
    const a = await avail();
    expect(a["2026-09-10"]).toBe(1);
    expect(a["2026-09-11"]).toBe(0);
    expect(a["2026-09-12"]).toBe(1);
  });

  it("a room that is both reserved and blocked counts once", async () => {
    // Block room A on night 10, where it is already reserved. Availability on
    // night 10 must stay 1 (distinct occupied rooms = {A}), not drop to 0.
    await prisma.block.create({
      data: { roomId: roomA, startDate: new Date("2026-09-10"), endDate: new Date("2026-09-11"), reason: "overlap" },
    });
    const a = await avail();
    expect(a["2026-09-10"]).toBe(1);
  });

  it("cancelling the reservation frees its nights", async () => {
    await prisma.reservation.updateMany({
      where: { roomId: roomA, status: "confirmed" },
      data: { status: "cancelled" },
    });
    const a = await avail();
    // Night 10: room A still blocked → 1. Night 11: room B blocked → 1.
    // Night 12: nothing left → back to 2.
    expect(a["2026-09-10"]).toBe(1);
    expect(a["2026-09-11"]).toBe(1);
    expect(a["2026-09-12"]).toBe(2);
  });
});
