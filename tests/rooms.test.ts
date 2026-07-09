import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/rooms/[id]/route";

// PATCH /api/rooms/[id] — the owner-facing edit that adds photos/facing/view
// content to a room (Settings → Rooms). Photos are validated URLs (max 8,
// mirrors FaqEntry.media); facing/view are free text; both are nullable/clearable.

const TAG = `rooms-${Date.now()}`;
let roomTypeId: string;
let roomId: string;

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function patch(body: unknown) {
  return new Request("http://localhost/api/rooms/x", { method: "PATCH", body: JSON.stringify(body) });
}

beforeAll(async () => {
  const rt = await prisma.roomType.create({ data: { name: `${TAG}-type`, baseRate: 2000, maxOccupancy: 2, rateFloor: 1000, rateCeiling: 4000 } });
  roomTypeId = rt.id;
  roomId = (await prisma.room.create({ data: { roomTypeId, label: `${TAG}-A` } })).id;
});

afterAll(async () => {
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
  await prisma.$disconnect();
});

describe("PATCH /api/rooms/[id] — photos/facing/view", () => {
  it("saves photos, facing, and view", async () => {
    const res = await PATCH(patch({ photos: ["https://example.com/1.jpg", "https://example.com/2.jpg"], facing: "East", view: "Pool view" }), ctx(roomId));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.photos).toEqual(["https://example.com/1.jpg", "https://example.com/2.jpg"]);
    expect(data.facing).toBe("East");
    expect(data.view).toBe("Pool view");
  });

  it("rejects a non-URL photo", async () => {
    const res = await PATCH(patch({ photos: ["not-a-url"] }), ctx(roomId));
    expect(res.status).toBe(422);
  });

  it("rejects more than 8 photos", async () => {
    const photos = Array.from({ length: 9 }, (_, i) => `https://example.com/${i}.jpg`);
    const res = await PATCH(patch({ photos }), ctx(roomId));
    expect(res.status).toBe(422);
  });

  it("clears facing/view/photos back to null/empty", async () => {
    const res = await PATCH(patch({ photos: null, facing: null, view: null }), ctx(roomId));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.photos).toBeNull();
    expect(data.facing).toBeNull();
    expect(data.view).toBeNull();
  });
});
