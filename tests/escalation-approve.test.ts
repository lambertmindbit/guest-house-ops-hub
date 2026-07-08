import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as approve } from "@/app/api/escalations/[id]/approve/route";
import { createEscalation } from "@/lib/escalations";

// POST /api/escalations/[id]/approve — one-tap approval for a booking-request
// escalation (filed by the public widget). Creates the reservation through the
// same guarded path as the manual form, resolves the escalation and links it,
// and — critically — leaves the escalation OPEN (not silently lost) when the
// room was booked by someone else in the meantime (the GiST 409).

const TAG = `escapprove-${Date.now()}`;
let roomId = "";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function fileBookingRequest(overrides: Partial<{
  roomId: string; checkIn: string; checkOut: string; guestName: string; guestPhone: string; total: number;
}> = {}) {
  const { escalation } = await createEscalation({
    source: "assistant",
    category: "booking",
    title: `${TAG}-request`,
    summary: "Guest requested a room via the public widget.",
    raisedByName: overrides.guestName ?? `${TAG}-guest`,
    raisedByContact: overrides.guestPhone ?? "9000000301",
    metadata: {
      kind: "booking_request",
      roomId: overrides.roomId ?? roomId,
      roomLabel: `${TAG}-201`,
      roomTypeName: `${TAG}-type`,
      checkIn: overrides.checkIn ?? "2026-10-10",
      checkOut: overrides.checkOut ?? "2026-10-12",
      nights: 2,
      total: overrides.total ?? 5000,
      guestName: overrides.guestName ?? `${TAG}-guest`,
      guestPhone: overrides.guestPhone ?? "9000000301",
    },
  });
  return escalation.id;
}

beforeAll(async () => {
  const existing = await prisma.channel.findFirst({ where: { name: "Assistant (ROOT)" } });
  if (!existing) {
    await prisma.channel.create({ data: { name: "Assistant (ROOT)", commissionPct: 0, collectsPayment: false } });
  }
  const rt = await prisma.roomType.create({ data: { name: `${TAG}-type`, baseRate: 2500, maxOccupancy: 2, rateFloor: 500, rateCeiling: 5000 } });
  const room = await prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-201` } });
  roomId = room.id;
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { roomId } });
  await prisma.escalation.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.guest.deleteMany({ where: { phone: { startsWith: "900000030" } } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { name: `${TAG}-type` } });
  await prisma.$disconnect();
});

describe("POST /api/escalations/[id]/approve", () => {
  it("404s for an unknown escalation", async () => {
    const res = await approve(new Request("http://localhost", { method: "POST" }), ctx("does-not-exist"));
    expect(res.status).toBe(404);
  });

  it("422s when the metadata is incomplete", async () => {
    const { escalation } = await createEscalation({
      source: "assistant", category: "booking", title: `${TAG}-incomplete`, summary: "missing details",
    });
    const res = await approve(new Request("http://localhost", { method: "POST" }), ctx(escalation.id));
    expect(res.status).toBe(422);
  });

  it("approves a booking request: creates the reservation and resolves the escalation", async () => {
    const id = await fileBookingRequest({ checkIn: "2026-10-10", checkOut: "2026-10-12", guestPhone: "9000000301" });
    const res = await approve(new Request("http://localhost", { method: "POST" }), ctx(id));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.guest.phone).toBe("9000000301");
    expect(data.room.id).toBe(roomId);

    const row = await prisma.escalation.findUnique({ where: { id } });
    expect(row?.status).toBe("resolved");
    expect(row?.relatedType).toBe("reservation");
    expect(row?.relatedId).toBe(data.id);
  });

  it("returns 409 and leaves the escalation OPEN when the room is already booked for those dates", async () => {
    const id = await fileBookingRequest({ checkIn: "2026-10-10", checkOut: "2026-10-12", guestPhone: "9000000302" });
    const res = await approve(new Request("http://localhost", { method: "POST" }), ctx(id));
    expect(res.status).toBe(409);

    const row = await prisma.escalation.findUnique({ where: { id } });
    expect(row?.status).toBe("open"); // not silently resolved — still needs the owner
  });

  it("409s approving an already-resolved escalation", async () => {
    const id = await fileBookingRequest({ checkIn: "2026-11-01", checkOut: "2026-11-03", guestPhone: "9000000303" });
    const first = await approve(new Request("http://localhost", { method: "POST" }), ctx(id));
    expect(first.status).toBe(201);
    const second = await approve(new Request("http://localhost", { method: "POST" }), ctx(id));
    expect(second.status).toBe(409);
  });
});
