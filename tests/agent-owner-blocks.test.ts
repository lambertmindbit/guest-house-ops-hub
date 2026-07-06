import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as postBlock } from "@/app/api/agent/owner/blocks/route";

// POST /api/agent/owner/blocks — the owner console agent blocks a room. Owner-only
// (401 without the token), creates a [start, end) block, and rejects an end date
// that isn't after the start.

const TEST_TOKEN = "test-agent-blocks";
const TAG = `blk-${Date.now()}`;
let roomId = "";

function makePost(bodyObj: unknown, token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["x-agent-token"] = token;
  return new Request("http://localhost/api/agent/owner/blocks", { method: "POST", headers, body: JSON.stringify(bodyObj) });
}

beforeAll(async () => {
  process.env.AGENT_TOKEN = TEST_TOKEN;
  const rt = await prisma.roomType.create({
    data: { name: `${TAG}-type`, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 5000 },
  });
  const room = await prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-201` } });
  roomId = room.id;
});

afterAll(async () => {
  await prisma.block.deleteMany({ where: { roomId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { name: `${TAG}-type` } });
  await prisma.$disconnect();
});

describe("agent owner blocks endpoint", () => {
  it("401s without the token", async () => {
    const res = await postBlock(makePost({ roomId, startDate: "2026-11-01", endDate: "2026-11-03" }));
    expect(res.status).toBe(401);
  });

  it("creates a block for the room", async () => {
    const res = await postBlock(makePost({ roomId, startDate: "2026-11-01", endDate: "2026-11-03", reason: "repairs" }, TEST_TOKEN));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data).toMatchObject({ room: `${TAG}-201`, startDate: "2026-11-01", endDate: "2026-11-03", reason: "repairs" });
    const rows = await prisma.block.findMany({ where: { roomId } });
    expect(rows).toHaveLength(1);
  });

  it("rejects an end date not after the start", async () => {
    const res = await postBlock(makePost({ roomId, startDate: "2026-11-05", endDate: "2026-11-05" }, TEST_TOKEN));
    expect(res.status).toBe(422);
  });
});
