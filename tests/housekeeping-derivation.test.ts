import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getHousekeeping } from "@/lib/housekeeping";
import { todayDateOnly, addDays, parseDateOnly } from "@/lib/dates";

// NFR-MNT-02 / US-904: housekeeping is *derived* (never a stored "dirty" counter),
// so it needs a derivation test. Proves the two transitions the owner relies on:
// a checkout makes a room need cleaning; marking it clean returns it to ready.
// Asserts only this test's own room, so it's robust against parallel fixtures.

const TAG = `hk-deriv-${Date.now()}`;
let roomId: string;
let guestId: string;
let channelId: string;
let reservationId: string;

beforeAll(async () => {
  const roomType = await prisma.roomType.create({
    data: { name: `${TAG}-t`, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 },
  });
  const [room, guest, channel] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: roomType.id, label: `${TAG}-A` } }),
    prisma.guest.create({ data: { name: `${TAG}-g`, phone: TAG } }),
    prisma.channel.create({ data: { name: `${TAG}-c`, commissionPct: 0, collectsPayment: false } }),
  ]);
  roomId = room.id;
  guestId = guest.id;
  channelId = channel.id;
  // A guest who checked out yesterday → the room should read as needing cleaning today.
  const r = await prisma.reservation.create({
    data: {
      roomId,
      guestId,
      channelId,
      checkIn: parseDateOnly(addDays(todayDateOnly(), -3)),
      checkOut: parseDateOnly(addDays(todayDateOnly(), -1)),
    },
  });
  reservationId = r.id;
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { id: reservationId } });
  await prisma.guest.deleteMany({ where: { phone: TAG } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { name: `${TAG}-t` } });
  await prisma.channel.deleteMany({ where: { name: `${TAG}-c` } });
  await prisma.$disconnect();
});

const myRoom = (hk: Awaited<ReturnType<typeof getHousekeeping>>) => hk.rooms.find((r) => r.id === roomId);

describe("housekeeping derivation", () => {
  it("a room a guest has checked out of needs cleaning", async () => {
    const hk = await getHousekeeping();
    expect(myRoom(hk)?.needsCleaning).toBe(true);
  });

  it("marking the room clean returns it to ready", async () => {
    await prisma.room.update({
      where: { id: roomId },
      data: { lastCleanedAt: new Date(), needsCleaningFlag: false },
    });
    const hk = await getHousekeeping();
    expect(myRoom(hk)?.needsCleaning).toBe(false);
  });
});
