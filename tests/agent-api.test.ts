import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as getAvailability } from "@/app/api/agent/availability/route";
import { GET as getQuote } from "@/app/api/agent/quote/route";
import { POST as postReservation } from "@/app/api/agent/reservations/route";

// Integration tests for the Phase B agent API seam.
// Proves:
//   (1) all endpoints return 401 without the token
//   (2) GET /api/agent/availability returns nightly availability
//   (3) GET /api/agent/quote returns a price quote
//   (4) POST /api/agent/reservations creates a confirmed booking
//   (5) POST /api/agent/reservations returns 409 on an overlapping stay

const TEST_TOKEN = "test-agent-token-phase-b";
const TAG = `test-agent-b-${Date.now()}`;

let roomId: string;
let roomTypeId: string;
let channelId: string;

function makeGet(path: string, params: Record<string, string>, token?: string): Request {
  const url = new URL(`http://localhost${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (token) headers["x-agent-token"] = token;
  return new Request(url.toString(), { method: "GET", headers });
}

function makePost(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-agent-token"] = token;
  return new Request("http://localhost/api/agent/reservations", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  process.env.AGENT_TOKEN = TEST_TOKEN;

  const roomType = await prisma.roomType.create({
    data: { name: `${TAG}-type`, baseRate: 1500, maxOccupancy: 2, rateFloor: 800, rateCeiling: 4000 },
  });
  const room = await prisma.room.create({ data: { roomTypeId: roomType.id, label: `${TAG}-R1` } });
  const channel = await prisma.channel.create({
    data: { name: `${TAG}-channel`, commissionPct: 0, collectsPayment: false },
  });
  roomId = room.id;
  roomTypeId = roomType.id;
  channelId = channel.id;
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { room: { label: { startsWith: TAG } } } });
  await prisma.room.deleteMany({ where: { label: { startsWith: TAG } } });
  await prisma.roomType.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.channel.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.guest.deleteMany({ where: { phone: { startsWith: TAG } } });
  delete process.env.AGENT_TOKEN;
});

describe("token gate — all agent endpoints", () => {
  it("availability: 401 without token", async () => {
    const res = await getAvailability(
      makeGet("/api/agent/availability", { roomTypeId, checkIn: "2030-01-01", checkOut: "2030-01-03" }),
    );
    expect(res.status).toBe(401);
  });

  it("quote: 401 without token", async () => {
    const res = await getQuote(
      makeGet("/api/agent/quote", { roomId, checkIn: "2030-01-01", checkOut: "2030-01-03" }),
    );
    expect(res.status).toBe(401);
  });

  it("reservations: 401 without token", async () => {
    const res = await postReservation(makePost({}));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/agent/availability", () => {
  it("returns nightly availability array with date, total, available", async () => {
    const res = await getAvailability(
      makeGet("/api/agent/availability", { roomTypeId, checkIn: "2030-02-01", checkOut: "2030-02-03" }, TEST_TOKEN),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(2); // 2 nights
    expect(json.data[0]).toMatchObject({ date: "2030-02-01", total: 1, available: 1 });
  });
});

describe("GET /api/agent/quote", () => {
  it("returns a quote with total and nights array", async () => {
    const res = await getQuote(
      makeGet("/api/agent/quote", { roomId, checkIn: "2030-03-01", checkOut: "2030-03-03" }, TEST_TOKEN),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.data.total).toBe("number");
    expect(json.data.total).toBeGreaterThan(0);
    expect(Array.isArray(json.data.nights)).toBe(true);
    expect(json.data.nights.length).toBe(2);
  });
});

describe("POST /api/agent/reservations", () => {
  it("creates a confirmed reservation and returns 201", async () => {
    const res = await postReservation(
      makePost(
        {
          roomId,
          channelId,
          checkIn: "2030-04-01",
          checkOut: "2030-04-03",
          guest: { name: "Agent Test Guest", phone: `${TAG}-phone-1` },
        },
        TEST_TOKEN,
      ),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBeTruthy();
    expect(json.data.status).toBe("confirmed");

    const row = await prisma.reservation.findUnique({ where: { id: json.data.id } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe("confirmed");

    // The reservation's property is DERIVED FROM ITS ROOM — never orphaned. Without
    // this, an agent booking (no session) is stamped with the sole-property fallback,
    // which is null once a client has two properties, and the booking vanishes from
    // both calendars. Asserting equality with the room's property holds whatever the
    // room's property is.
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { propertyId: true } });
    expect(row?.propertyId).toBe(room?.propertyId ?? null);
  });

  it("returns 409 when an overlapping confirmed stay exists for the same room", async () => {
    // The previous test booked 2030-04-01 → 2030-04-03 on the same room.
    // This overlapping booking must be rejected by the GiST constraint.
    const res = await postReservation(
      makePost(
        {
          roomId,
          channelId,
          checkIn: "2030-04-02",
          checkOut: "2030-04-04",
          guest: { name: "Overlap Guest", phone: `${TAG}-phone-2` },
        },
        TEST_TOKEN,
      ),
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/no longer available/i);
  });

  it("returns 422 when neither guestId nor guest details are supplied", async () => {
    const res = await postReservation(
      makePost({ roomId, channelId, checkIn: "2030-05-01", checkOut: "2030-05-02" }, TEST_TOKEN),
    );
    expect(res.status).toBe(422);
  });
});
