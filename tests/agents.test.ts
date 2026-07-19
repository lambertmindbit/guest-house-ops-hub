import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { agentCommission, agentStatements } from "@/lib/agents";

// Pure commission math — whole-rupee rounding, identical to finance.ts so a
// channel and an agent never disagree by a paisa.
describe("agentCommission", () => {
  it("is gross × pct, rounded to whole rupees; values are paise", () => {
    expect(agentCommission(350_000, 10)).toBe(35_000); // ₹3,500 → ₹350
    expect(agentCommission(299_900, 10)).toBe(30_000); // ₹2,999 → ₹299.9 → ₹300
    expect(agentCommission(333_300, 10)).toBe(33_300); // ₹3,333 → ₹333.3 → ₹333
  });
  it("is zero at 0% (and for a free stay)", () => {
    expect(agentCommission(350_000, 0)).toBe(0);
    expect(agentCommission(0, 10)).toBe(0);
  });
});

// Integration: the per-agent statement counts only CONFIRMED bookings that carry
// this agent's id, arriving in the window. Uses isolated fixtures and cleans up.
const TAG = `test-agents-${Date.now()}`;
let agentId: string;
let roomId: string;
let guestId: string;
let channelId: string;

beforeAll(async () => {
  const roomType = await prisma.roomType.create({
    data: { name: `${TAG}-type`, baseRate: 3500, maxOccupancy: 2, rateFloor: 1000, rateCeiling: 6000 },
  });
  const room = await prisma.room.create({ data: { roomTypeId: roomType.id, label: `${TAG}-A` } });
  const guest = await prisma.guest.create({ data: { name: `${TAG}-guest`, phone: TAG } });
  const channel = await prisma.channel.create({ data: { name: `${TAG}-ch`, commissionPct: 0, collectsPayment: false } });
  const agent = await prisma.agent.create({ data: { name: `${TAG}-agent`, commissionPct: 10 } });
  roomId = room.id;
  guestId = guest.id;
  channelId = channel.id;
  agentId = agent.id;
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { guestId } });
  await prisma.agent.deleteMany({ where: { id: agentId } });
  await prisma.guest.deleteMany({ where: { phone: TAG } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { name: `${TAG}-type` } });
  await prisma.channel.deleteMany({ where: { name: `${TAG}-ch` } });
  await prisma.$disconnect();
});

describe("agentStatements", () => {
  it("sums an agent's confirmed bookings and derives the commission owed", async () => {
    // Two of this agent's bookings in July (non-overlapping, same room)…
    // Money is paise (GAP-9): ₹3,500 and ₹2,500.
    await prisma.reservation.create({ data: { roomId, guestId, channelId, agentId, checkIn: new Date("2026-07-05"), checkOut: new Date("2026-07-07"), grossAmount: 350_000 } });
    await prisma.reservation.create({ data: { roomId, guestId, channelId, agentId, checkIn: new Date("2026-07-10"), checkOut: new Date("2026-07-12"), grossAmount: 250_000 } });
    // …one with NO agent (direct) — must be excluded…
    await prisma.reservation.create({ data: { roomId, guestId, channelId, checkIn: new Date("2026-07-15"), checkOut: new Date("2026-07-17"), grossAmount: 999_900 } });
    // …and one attributed but CANCELLED — must be excluded.
    await prisma.reservation.create({ data: { roomId, guestId, channelId, agentId, status: "cancelled", checkIn: new Date("2026-07-20"), checkOut: new Date("2026-07-22"), grossAmount: 400_000 } });

    const rows = await agentStatements("2026-07-01", "2026-08-01");
    const mine = rows.find((r) => r.agentId === agentId);

    expect(mine).toBeDefined();
    expect(mine!.bookings).toBe(2);
    expect(mine!.gross).toBe(600_000); // ₹6,000
    expect(mine!.commission).toBe(60_000); // 10% of ₹6,000 = ₹600
  });

  it("omits an agent with no bookings in the window", async () => {
    const rows = await agentStatements("2026-01-01", "2026-02-01");
    expect(rows.find((r) => r.agentId === agentId)).toBeUndefined();
  });
});
