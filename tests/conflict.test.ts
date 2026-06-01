import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { isOverlapError } from "@/lib/db-errors";

// Integration test against the real Postgres. Proves the single most important
// Phase 1 requirement: two CONFIRMED reservations for the same physical room
// cannot overlap, enforced by the DB. Uses isolated fixtures and cleans up.

const TAG = `test-conflict-${Date.now()}`;
let roomId: string;
let altRoomId: string;
let guestId: string;
let channelId: string;
const reservationIds: string[] = [];

beforeAll(async () => {
  const roomType = await prisma.roomType.create({
    data: {
      name: `${TAG}-type`,
      baseRate: 1000,
      maxOccupancy: 2,
      rateFloor: 500,
      rateCeiling: 3000,
    },
  });
  const [room, altRoom] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: roomType.id, label: `${TAG}-A` } }),
    prisma.room.create({ data: { roomTypeId: roomType.id, label: `${TAG}-B` } }),
  ]);
  const guest = await prisma.guest.create({
    data: { name: `${TAG}-guest`, phone: TAG },
  });
  const channel = await prisma.channel.create({
    data: { name: `${TAG}-channel`, commissionPct: 0, collectsPayment: false },
  });
  roomId = room.id;
  altRoomId = altRoom.id;
  guestId = guest.id;
  channelId = channel.id;
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { id: { in: reservationIds } } });
  await prisma.guest.deleteMany({ where: { phone: TAG } });
  await prisma.room.deleteMany({ where: { id: { in: [roomId, altRoomId] } } });
  await prisma.roomType.deleteMany({ where: { name: `${TAG}-type` } });
  await prisma.channel.deleteMany({ where: { name: `${TAG}-channel` } });
  await prisma.$disconnect();
});

function reservation(roomTarget: string, checkIn: string, checkOut: string) {
  return {
    roomId: roomTarget,
    guestId,
    channelId,
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
  };
}

describe("no-double-booking exclusion constraint", () => {
  it("accepts the first confirmed reservation", async () => {
    const r = await prisma.reservation.create({
      data: reservation(roomId, "2026-07-10", "2026-07-13"),
    });
    reservationIds.push(r.id);
    expect(r.id).toBeTruthy();
  });

  it("rejects an overlapping confirmed reservation on the same room", async () => {
    await expect(
      prisma.reservation.create({
        data: reservation(roomId, "2026-07-12", "2026-07-15"),
      }),
    ).rejects.toSatisfy(isOverlapError);
  });

  it("allows same-day turnover (checkout == next check-in)", async () => {
    const r = await prisma.reservation.create({
      data: reservation(roomId, "2026-07-13", "2026-07-16"),
    });
    reservationIds.push(r.id);
    expect(r.id).toBeTruthy();
  });

  it("allows overlapping dates on a different room", async () => {
    const r = await prisma.reservation.create({
      data: reservation(altRoomId, "2026-07-10", "2026-07-13"),
    });
    reservationIds.push(r.id);
    expect(r.id).toBeTruthy();
  });

  it("frees the dates when the blocking reservation is cancelled", async () => {
    const first = await prisma.reservation.create({
      data: reservation(altRoomId, "2026-08-01", "2026-08-05"),
    });
    reservationIds.push(first.id);

    // Same room+dates is blocked while confirmed...
    await expect(
      prisma.reservation.create({
        data: reservation(altRoomId, "2026-08-02", "2026-08-04"),
      }),
    ).rejects.toSatisfy(isOverlapError);

    // ...but cancelling the first drops it out of the constraint predicate.
    await prisma.reservation.update({
      where: { id: first.id },
      data: { status: "cancelled" },
    });
    const second = await prisma.reservation.create({
      data: reservation(altRoomId, "2026-08-02", "2026-08-04"),
    });
    reservationIds.push(second.id);
    expect(second.id).toBeTruthy();
  });
});
