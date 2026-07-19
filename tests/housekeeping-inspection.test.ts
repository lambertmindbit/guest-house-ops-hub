import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cleaningState } from "@/lib/housekeeping";
import { PATCH as patchRoom } from "@/app/api/rooms/[id]/route";

// GAP-20: the optional inspection step. cleaningState is the derived state machine
// getHousekeeping uses; test it directly (no global property-setting flips, which
// would be shared across parallel test files).

const t0 = new Date("2026-07-19T08:00:00Z");
const t1 = new Date("2026-07-19T09:00:00Z");
const t2 = new Date("2026-07-19T10:00:00Z");
const departure = new Date("2026-07-19T07:00:00Z");

describe("cleaningState (GAP-20)", () => {
  const clean = { needsCleaningFlag: false, lastCleanedAt: t1, lastInspectedAt: null };

  it("a departure after the last clean → needs cleaning (inspection irrelevant)", () => {
    const room = { needsCleaningFlag: false, lastCleanedAt: t0, lastInspectedAt: null };
    expect(cleaningState(room, t2, true)).toEqual({ needsCleaning: true, awaitingInspection: false });
  });

  it("manual dirty flag → needs cleaning", () => {
    const room = { needsCleaningFlag: true, lastCleanedAt: t2, lastInspectedAt: t2 };
    expect(cleaningState(room, null, true).needsCleaning).toBe(true);
  });

  it("inspection OFF: a cleaned room is immediately ready", () => {
    expect(cleaningState(clean, departure, false)).toEqual({ needsCleaning: false, awaitingInspection: false });
  });

  it("inspection ON: a cleaned-but-uninspected room is awaiting inspection", () => {
    expect(cleaningState(clean, departure, true)).toEqual({ needsCleaning: false, awaitingInspection: true });
  });

  it("inspection ON: inspected after cleaning → ready", () => {
    const room = { needsCleaningFlag: false, lastCleanedAt: t1, lastInspectedAt: t2 };
    expect(cleaningState(room, departure, true)).toEqual({ needsCleaning: false, awaitingInspection: false });
  });

  it("inspection ON: a stale inspection (before the latest clean) is still awaiting", () => {
    const room = { needsCleaningFlag: false, lastCleanedAt: t2, lastInspectedAt: t1 };
    expect(cleaningState(room, departure, true).awaitingInspection).toBe(true);
  });
});

// ── Integration: the inspect endpoint stamps last_inspected_at ────────────────

const TAG = `hk-insp-${Date.now()}`;
let roomId: string;

beforeAll(async () => {
  const rt = await prisma.roomType.create({ data: { name: `${TAG}-t`, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 } });
  const room = await prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-A`, lastCleanedAt: new Date() } });
  roomId = room.id;
});

afterAll(async () => {
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { name: `${TAG}-t` } });
  await prisma.$disconnect();
});

describe("mark-inspected endpoint", () => {
  it("PATCH { markInspected: true } stamps last_inspected_at", async () => {
    expect((await prisma.room.findUnique({ where: { id: roomId } }))?.lastInspectedAt).toBeNull();
    const req = new Request(`http://localhost/api/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markInspected: true }),
    });
    const res = await patchRoom(req, { params: Promise.resolve({ id: roomId }) });
    expect(res.status).toBe(200);
    expect((await prisma.room.findUnique({ where: { id: roomId } }))?.lastInspectedAt).not.toBeNull();
  });
});
