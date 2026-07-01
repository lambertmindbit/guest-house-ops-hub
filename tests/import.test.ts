import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { importCsv } from "@/lib/import";

// Integration test: proves the CSV importer routes bookings through the guarded
// create path, so an overlapping row is rejected by the DB constraint (409) —
// the importer can never bypass the no-double-booking guarantee.

const TAG = `test-import-${Date.now()}`;
const roomTypeName = `${TAG}-type`;
let roomLabel: string;
let channelName: string;

beforeAll(async () => {
  const rt = await prisma.roomType.create({
    data: { name: roomTypeName, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 },
  });
  const room = await prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-A` } });
  const channel = await prisma.channel.create({ data: { name: `${TAG}-chan`, commissionPct: 0, collectsPayment: false } });
  roomLabel = room.label;
  channelName = channel.name;
});

afterAll(async () => {
  const guests = await prisma.guest.findMany({ where: { phone: { startsWith: TAG } }, select: { id: true } });
  await prisma.reservation.deleteMany({ where: { guestId: { in: guests.map((g) => g.id) } } });
  await prisma.guest.deleteMany({ where: { phone: { startsWith: TAG } } });
  await prisma.room.deleteMany({ where: { label: `${TAG}-A` } });
  await prisma.roomType.deleteMany({ where: { name: roomTypeName } });
  await prisma.channel.deleteMany({ where: { name: `${TAG}-chan` } });
  await prisma.$disconnect();
});

describe("importCsv bookings", () => {
  it("creates a valid booking, rejects an overlap (409) and an unknown room per-row", async () => {
    const csv = [
      "phone,name,room,channel,checkin,checkout,amount",
      `${TAG}-g1,Alice,${roomLabel},${channelName},2026-09-10,2026-09-13,3000`,
      `${TAG}-g1,Alice,${roomLabel},${channelName},2026-09-12,2026-09-15,3000`, // overlaps row 2
      `${TAG}-g1,Alice,NoSuchRoom,${channelName},2026-09-20,2026-09-22,1000`, // unknown room
    ].join("\n");

    const res = await importCsv("bookings", csv);
    expect(res.created).toBe(1);
    expect(res.errors).toBe(2);
    expect(res.results.find((r) => r.row === 3)?.message).toContain("overlap");
    expect(res.results.find((r) => r.row === 4)?.message).toContain("unknown room");
  });

  it("dry-run validates without writing any rows", async () => {
    const before = await prisma.reservation.count();
    const csv = `phone,name,room,channel,checkin,checkout\n${TAG}-g2,Bob,${roomLabel},${channelName},2026-10-01,2026-10-03`;
    const res = await importCsv("bookings", csv, { dryRun: true });
    expect(res.created).toBe(1);
    expect(res.errors).toBe(0);
    expect(await prisma.reservation.count()).toBe(before);
  });
});
