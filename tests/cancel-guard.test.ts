import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as cancel } from "@/app/api/reservations/[id]/cancel/route";
import { addDays, todayDateOnly, parseDateOnly } from "@/lib/dates";

// F2/F3: cancel must refuse a stay that's in progress or over — cancelling a
// completed booking would silently erase it (and its payments) from Finance,
// which counts only 'confirmed' rows.

const TAG = `cancelguard-${Date.now()}`;
let roomTypeId = "";
let channelId = "";
let guestId = "";
const ids: string[] = [];
const roomIds: string[] = [];
let roomN = 0;

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function req() {
  return new Request("http://localhost/api/reservations/x/cancel", { method: "POST" });
}
async function makeReservation(overrides: {
  checkIn: string; checkOut: string; checkedInAt?: Date | null; checkedOutAt?: Date | null;
}) {
  // A fresh room per booking so overlapping test date ranges never trip the
  // no-double-booking exclusion constraint.
  const room = await prisma.room.create({ data: { roomTypeId, label: `${TAG}-r${roomN++}` } });
  roomIds.push(room.id);
  const r = await prisma.reservation.create({
    data: {
      roomId: room.id, guestId, channelId,
      checkIn: parseDateOnly(overrides.checkIn), checkOut: parseDateOnly(overrides.checkOut),
      checkedInAt: overrides.checkedInAt ?? null, checkedOutAt: overrides.checkedOutAt ?? null,
    },
  });
  ids.push(r.id);
  return r.id;
}

beforeAll(async () => {
  const rt = await prisma.roomType.create({ data: { name: `${TAG}-type`, baseRate: 2000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 5000 } });
  roomTypeId = rt.id;
  channelId = (await prisma.channel.create({ data: { name: `${TAG}-ch`, commissionPct: 0, collectsPayment: false } })).id;
  guestId = (await prisma.guest.create({ data: { name: `${TAG}-guest`, phone: TAG } })).id;
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { id: { in: ids } } });
  await prisma.guest.deleteMany({ where: { phone: TAG } });
  await prisma.channel.deleteMany({ where: { name: `${TAG}-ch` } });
  await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
  await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
  await prisma.$disconnect();
});

describe("POST /api/reservations/[id]/cancel — guards", () => {
  it("cancels a future booking", async () => {
    const id = await makeReservation({ checkIn: addDays(todayDateOnly(), 10), checkOut: addDays(todayDateOnly(), 12) });
    const res = await cancel(req(), ctx(id));
    expect(res.status).toBe(200);
  });

  it("refuses a checked-in (in-house) booking", async () => {
    const id = await makeReservation({ checkIn: todayDateOnly(), checkOut: addDays(todayDateOnly(), 2), checkedInAt: new Date() });
    const res = await cancel(req(), ctx(id));
    expect(res.status).toBe(409);
  });

  it("refuses a checked-out (completed) booking", async () => {
    const id = await makeReservation({ checkIn: addDays(todayDateOnly(), -3), checkOut: addDays(todayDateOnly(), -1), checkedOutAt: new Date() });
    const res = await cancel(req(), ctx(id));
    expect(res.status).toBe(409);
  });

  it("refuses a past booking even if never stamped", async () => {
    const id = await makeReservation({ checkIn: addDays(todayDateOnly(), -5), checkOut: addDays(todayDateOnly(), -2) });
    const res = await cancel(req(), ctx(id));
    expect(res.status).toBe(409);
  });
});
