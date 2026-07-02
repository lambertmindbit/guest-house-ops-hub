import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import { noShowStats, isRepeatOffender, guestNoShowStats } from "@/lib/community/reliability";

// ─── Pure ───────────────────────────────────────────────────────────────────

describe("noShowStats", () => {
  it("derives from statuses, excluding cancellations", () => {
    expect(noShowStats([])).toEqual({ total: 0, noShows: 0, kept: 0, noShowRate: 0, score: 100 });
    expect(noShowStats(["confirmed", "confirmed", "no_show"])).toEqual({ total: 3, noShows: 1, kept: 2, noShowRate: 1 / 3, score: 67 });
    expect(noShowStats(["cancelled", "no_show", "no_show", "confirmed"])).toMatchObject({ total: 3, noShows: 2, kept: 1 });
  });
});

describe("isRepeatOffender (conservative)", () => {
  it("needs ≥3 bookings, ≥2 no-shows and ≥40% rate", () => {
    expect(isRepeatOffender(noShowStats(["no_show", "no_show", "confirmed"]))).toBe(true);
    expect(isRepeatOffender(noShowStats(["no_show", "confirmed"]))).toBe(false); // too few bookings
    expect(isRepeatOffender(noShowStats(["no_show", "confirmed", "confirmed", "confirmed", "confirmed"]))).toBe(false); // 1 no-show
    expect(isRepeatOffender(noShowStats(["confirmed", "confirmed", "confirmed"]))).toBe(false); // reliable
  });
});

// ─── DB ─────────────────────────────────────────────────────────────────────

const TAG = `rel-${Date.now()}`;
let P: string;
let guestId: string;
let roomId: string;
let channelId: string;

beforeAll(async () => {
  __resetTenantResolution();
  P = (await prisma.propertySettings.create({ data: { name: `${TAG}-P` } })).id;
  const pdb = prismaForTenant(P);
  const rt = await pdb.roomType.create({ data: { name: `${TAG}-t`, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 } });
  roomId = (await pdb.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-1` } })).id;
  guestId = (await pdb.guest.create({ data: { name: `${TAG}-g`, phone: `${TAG}` } })).id;
  channelId = (await pdb.channel.create({ data: { name: `${TAG}-c`, commissionPct: 0, collectsPayment: false } })).id;

  // 2 no-shows + 1 confirmed (no_show/cancelled are exempt from the GiST guard).
  const mk = (status: "confirmed" | "no_show", from: string, to: string) =>
    pdb.reservation.create({ data: { roomId, guestId, channelId, status, checkIn: new Date(from), checkOut: new Date(to) } });
  await mk("no_show", "2026-08-01", "2026-08-02");
  await mk("no_show", "2026-08-10", "2026-08-11");
  await mk("confirmed", "2026-08-20", "2026-08-21");
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { guestId } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { propertyId: P } });
  await prisma.propertySettings.deleteMany({ where: { id: P } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("guestNoShowStats", () => {
  it("computes a guest's no-show record and flags a repeat offender", async () => {
    const stats = await guestNoShowStats(guestId);
    expect(stats).toMatchObject({ total: 3, noShows: 2, kept: 1 });
    expect(isRepeatOffender(stats)).toBe(true);
  });
});
