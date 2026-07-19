import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/reservations/route";

// Route-level integration test (NFR-MNT-02 / US-903): the repo's top-priority test
// gap. tests/conflict.test.ts proves the DB constraint at the model level; this
// proves the *API* turns that constraint's Postgres error into a clean 409 with the
// friendly envelope — i.e. it guards the string-sniffing in src/lib/db-errors.ts,
// which is the fragile bit. Exercises the real POST handler, not the model.

const TAG = `rt-overlap-${Date.now()}`;
let roomId: string;
let guestId: string;
let channelId: string;
const created: string[] = [];

beforeAll(async () => {
  const roomType = await prisma.roomType.create({
    data: { name: `${TAG}-t`, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 },
  });
  const [room, guest, channel] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: roomType.id, label: `${TAG}-A` } }),
    prisma.guest.create({ data: { name: `${TAG}-g`, phone: TAG } }),
    prisma.channel.create({ data: { name: `${TAG}-c`, commissionPct: 0, collectsPayment: false } }),
  ]);
  roomId = room.id;
  guestId = guest.id;
  channelId = channel.id;
});

afterAll(async () => {
  // Booking confirmations are logged to the outbox by the route — clear them
  // before the guest/reservation rows they reference.
  await prisma.outboundMessage.deleteMany({ where: { guestId } });
  await prisma.reservation.deleteMany({ where: { id: { in: created } } });
  await prisma.guest.deleteMany({ where: { phone: TAG } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { name: `${TAG}-t` } });
  await prisma.channel.deleteMany({ where: { name: `${TAG}-c` } });
  await prisma.$disconnect();
});

function postReservation(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/reservations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reservations — overlap is a friendly 409", () => {
  it("creates the first reservation (201, { data })", async () => {
    const res = await POST(postReservation({ roomId, guestId, channelId, checkIn: "2027-03-10", checkOut: "2027-03-13" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data?.id).toBeTruthy();
    created.push(body.data.id);
  });

  it("rejects an overlapping confirmed stay with 409 and the friendly envelope", async () => {
    const res = await POST(postReservation({ roomId, guestId, channelId, checkIn: "2027-03-12", checkOut: "2027-03-15" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: "Those dates are no longer available for this room." });
    expect(body.data).toBeUndefined(); // it did not silently create
  });

  it("still allows a same-day turnover on the same room (checkout == next check-in)", async () => {
    const res = await POST(postReservation({ roomId, guestId, channelId, checkIn: "2027-03-13", checkOut: "2027-03-16" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    created.push(body.data.id);
  });
});
