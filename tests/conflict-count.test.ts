import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getConflicts, countConflicts } from "@/lib/conflicts";
import { parseDateOnly } from "@/lib/dates";

// The "Needs you" nav badge renders countConflicts(); the /needs-you page renders
// getConflicts(). If those two ever disagree the badge lies about how much work is
// waiting — which is exactly the bug this pins (the badge used to be served from a
// 60s cache and drifted from the live page).

const TAG = `confcount-${Date.now()}`;
let roomTypeId = "";
let channelId = "";
let guestId = "";
let roomId = "";
const ids: string[] = [];
const blockIds: string[] = [];

beforeAll(async () => {
  const rt = await prisma.roomType.create({
    data: { name: `${TAG}-type`, baseRate: 2000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 5000 },
  });
  roomTypeId = rt.id;
  roomId = (await prisma.room.create({ data: { roomTypeId, label: `${TAG}-r1` } })).id;
  channelId = (await prisma.channel.create({ data: { name: `${TAG}-ch`, commissionPct: 0, collectsPayment: false } })).id;
  guestId = (await prisma.guest.create({ data: { name: `${TAG}-guest`, phone: TAG } })).id;
});

afterAll(async () => {
  await prisma.block.deleteMany({ where: { id: { in: blockIds } } });
  await prisma.reservation.deleteMany({ where: { id: { in: ids } } });
  await prisma.guest.deleteMany({ where: { phone: TAG } });
  await prisma.channel.deleteMany({ where: { name: `${TAG}-ch` } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
  await prisma.$disconnect();
});

describe("countConflicts stays in step with getConflicts", () => {
  it("agrees with the full list before and after a conflict appears", async () => {
    const before = await countConflicts();
    expect(before).toBe((await getConflicts()).length);

    // A confirmed stay AND a block over the same nights on the same room = conflict.
    const res = await prisma.reservation.create({
      data: {
        roomId, guestId, channelId,
        checkIn: parseDateOnly("2027-03-10"),
        checkOut: parseDateOnly("2027-03-14"),
      },
    });
    ids.push(res.id);
    const block = await prisma.block.create({
      data: {
        roomId,
        startDate: parseDateOnly("2027-03-11"),
        endDate: parseDateOnly("2027-03-13"),
        reason: `${TAG} maintenance`,
      },
    });
    blockIds.push(block.id);

    const after = await countConflicts();
    expect(after).toBe(before + 1);
    // The badge number and the page's list must never disagree.
    expect(after).toBe((await getConflicts()).length);
  });
});
