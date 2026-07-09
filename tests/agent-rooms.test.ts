import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as getCatalog } from "@/app/api/agent/rooms/route";
import { GET as getRoomAvailability } from "@/app/api/agent/rooms/availability/route";
import { GET as getTypeAvailability } from "@/app/api/agent/availability/route";

// P1 of docs/ROOT-INTEGRATION-PLAN.md — the seam additions the ROOT agent
// grounds itself on. Proves:
//   (1) both endpoints 401 without the token
//   (2) the catalog lists active rooms with type/capacity/base rate
//   (3) room-level availability marks a booked room busy and its sibling free
//   (4) room-level and room-type-level availability AGREE for the same range

const TEST_TOKEN = "test-agent-rooms-p1";
const TAG = `agent-rooms-${Date.now()}`;

let roomTypeId: string;
let roomA: string;
let roomB: string;
let channelId: string;
let guestId: string;
let amenityId: string;

function makeGet(path: string, params: Record<string, string>, token?: string): Request {
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (token) headers["x-agent-token"] = token;
  return new Request(url.toString(), { method: "GET", headers });
}

beforeAll(async () => {
  process.env.AGENT_TOKEN = TEST_TOKEN;

  const rt = await prisma.roomType.create({
    data: { name: `${TAG}-type`, baseRate: 2500, maxOccupancy: 3, rateFloor: 1000, rateCeiling: 6000 },
  });
  roomTypeId = rt.id;
  roomA = (
    await prisma.room.create({
      data: {
        roomTypeId, label: `${TAG}-A`,
        photos: ["https://example.com/a1.jpg", "https://example.com/a2.jpg"],
        facing: "East", view: "Pool view",
      },
    })
  ).id;
  roomB = (await prisma.room.create({ data: { roomTypeId, label: `${TAG}-B` } })).id;
  channelId = (await prisma.channel.create({ data: { name: `${TAG}-ch`, commissionPct: 0, collectsPayment: false } })).id;
  guestId = (await prisma.guest.create({ data: { name: `${TAG}-guest`, phone: TAG } })).id;
  const amenity = await prisma.amenity.create({ data: { name: `${TAG}-wifi` } });
  amenityId = amenity.id;
  await prisma.roomTypeAmenity.create({ data: { roomTypeId, amenityId } });

  // Room A is booked 2031-05-10 → 2031-05-12.
  await prisma.reservation.create({
    data: {
      roomId: roomA, guestId, channelId,
      checkIn: new Date("2031-05-10"), checkOut: new Date("2031-05-12"),
    },
  });
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { roomId: { in: [roomA, roomB] } } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.roomTypeAmenity.deleteMany({ where: { roomTypeId } });
  await prisma.amenity.deleteMany({ where: { id: amenityId } });
  await prisma.room.deleteMany({ where: { id: { in: [roomA, roomB] } } });
  await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
  await prisma.$disconnect();
});

describe("agent rooms seam (P1)", () => {
  it("401s without the token", async () => {
    expect((await getCatalog(makeGet("/api/agent/rooms", {}))).status).toBe(401);
    expect(
      (await getRoomAvailability(
        makeGet("/api/agent/rooms/availability", { checkIn: "2031-05-10", checkOut: "2031-05-12" }),
      )).status,
    ).toBe(401);
  });

  it("catalog lists active rooms with type, capacity and base rate", async () => {
    const res = await getCatalog(makeGet("/api/agent/rooms", {}, TEST_TOKEN));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const a = data.find((r: { id: string }) => r.id === roomA);
    expect(a).toMatchObject({
      label: `${TAG}-A`,
      roomTypeId,
      roomTypeName: `${TAG}-type`,
      maxOccupancy: 3,
      baseRate: 2500,
      photos: ["https://example.com/a1.jpg", "https://example.com/a2.jpg"],
      facing: "East",
      view: "Pool view",
      amenities: [`${TAG}-wifi`],
    });
    const b = data.find((r: { id: string }) => r.id === roomB);
    expect(b).toMatchObject({ photos: [], facing: null, view: null, amenities: [`${TAG}-wifi`] });
  });

  it("room-level availability: booked room busy, sibling free; roomIds filter works", async () => {
    const res = await getRoomAvailability(
      makeGet("/api/agent/rooms/availability", {
        checkIn: "2031-05-10", checkOut: "2031-05-12", roomIds: `${roomA},${roomB}`,
      }, TEST_TOKEN),
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toHaveLength(2);
    expect(data.find((r: { id: string }) => r.id === roomA)?.free).toBe(false);
    expect(data.find((r: { id: string }) => r.id === roomB)?.free).toBe(true);
  });

  it("a non-overlapping range frees the booked room (half-open: checkout day is free)", async () => {
    const res = await getRoomAvailability(
      makeGet("/api/agent/rooms/availability", {
        checkIn: "2031-05-12", checkOut: "2031-05-14", roomIds: roomA,
      }, TEST_TOKEN),
    );
    const { data } = await res.json();
    expect(data.find((r: { id: string }) => r.id === roomA)?.free).toBe(true);
  });

  it("room-level and type-level availability agree", async () => {
    // Type-level: 2 rooms, 1 booked → 1 available on the booked nights.
    const typeRes = await getTypeAvailability(
      makeGet("/api/agent/availability", { roomTypeId, checkIn: "2031-05-10", checkOut: "2031-05-12" }, TEST_TOKEN),
    );
    const { data: nights } = await typeRes.json();
    for (const n of nights) {
      expect(n.total).toBe(2);
      expect(n.available).toBe(1);
    }

    // Room-level for the same range: exactly one of the pair is free.
    const roomRes = await getRoomAvailability(
      makeGet("/api/agent/rooms/availability", {
        checkIn: "2031-05-10", checkOut: "2031-05-12", roomIds: `${roomA},${roomB}`,
      }, TEST_TOKEN),
    );
    const { data: rooms } = await roomRes.json();
    expect(rooms.filter((r: { free: boolean }) => r.free)).toHaveLength(1);
  });
});
