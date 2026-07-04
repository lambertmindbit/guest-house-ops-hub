import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import { updateReservation, StaleWriteError } from "@/lib/reservations";

// L-4: optimistic concurrency on reservation edits.
const TAG = `resver-${Date.now()}`;
let P: string;
let reservationId: string;

beforeAll(async () => {
  __resetTenantResolution();
  P = (await prisma.propertySettings.create({ data: { name: `${TAG}-P` } })).id;
  const db = prismaForTenant(P);
  const rt = await db.roomType.create({ data: { name: `${TAG}-t`, baseRate: 2000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 5000 } });
  const room = await db.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-1` } });
  const guest = await db.guest.create({ data: { name: `${TAG}-g`, phone: TAG } });
  const channel = await db.channel.create({ data: { name: `${TAG}-c`, commissionPct: 0, collectsPayment: false } });
  reservationId = (await db.reservation.create({
    data: { roomId: room.id, guestId: guest.id, channelId: channel.id, checkIn: new Date("2026-09-01"), checkOut: new Date("2026-09-03"), grossAmount: 2000 },
  })).id;
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { propertyId: P } });
  await prisma.guest.deleteMany({ where: { propertyId: P } });
  await prisma.channel.deleteMany({ where: { propertyId: P } });
  await prisma.room.deleteMany({ where: { propertyId: P } });
  await prisma.roomType.deleteMany({ where: { propertyId: P } });
  await prisma.propertySettings.deleteMany({ where: { id: P } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("reservation optimistic concurrency", () => {
  it("bumps version on every update", async () => {
    const before = await prisma.reservation.findUnique({ where: { id: reservationId }, select: { version: true } });
    await updateReservation(reservationId, { arrivalTime: "13:00" });
    const after = await prisma.reservation.findUnique({ where: { id: reservationId }, select: { version: true } });
    expect(after!.version).toBe(before!.version + 1);
  });

  it("rejects a second edit made from a stale version", async () => {
    const { version } = (await prisma.reservation.findUnique({ where: { id: reservationId }, select: { version: true } }))!;
    // First writer wins with the current version.
    await updateReservation(reservationId, { specialRequests: "first" }, version);
    // Second writer had loaded the same version — must be rejected, not clobber.
    await expect(updateReservation(reservationId, { specialRequests: "second" }, version)).rejects.toBeInstanceOf(StaleWriteError);
    const now = await prisma.reservation.findUnique({ where: { id: reservationId }, select: { specialRequests: true } });
    expect(now!.specialRequests).toBe("first"); // second write did not land
  });
});
