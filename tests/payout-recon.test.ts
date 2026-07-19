import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The payout route audits via recordAudit → getSession → cookies() (throws in tests).
vi.mock("@/lib/session", () => ({ getSession: async () => null }));

import { prisma, __resetTenantResolution } from "@/lib/prisma";
import { reconcilePayouts, commissionOn, getPayoutReconciliation } from "@/lib/finance";
import { POST as createPayout } from "@/app/api/payouts/route";
import { DELETE as deletePayout } from "@/app/api/payouts/[id]/route";

// ─── Pure arithmetic ──────────────────────────────────────────────────────────

describe("commissionOn", () => {
  it("rounds % of gross (matches the By-channel net)", () => {
    expect(commissionOn(10000, 15)).toBe(1500);
    expect(commissionOn(999, 15)).toBe(150); // 149.85 → 150
  });
});

describe("reconcilePayouts (pure, cumulative)", () => {
  const channels = [{ id: "bcom", name: "Booking.com" }, { id: "agoda", name: "Agoda" }];

  it("owed − received = variance; positive means the OTA still owes you", () => {
    const rows = reconcilePayouts(
      channels,
      [{ channelId: "bcom", owed: 8500 }, { channelId: "bcom", owed: 4250 }],
      [{ id: "p1", channelId: "bcom", amount: 8500, paidAt: "2026-07-01", reference: null, note: null }],
    );
    const bcom = rows.find((r) => r.channelId === "bcom")!;
    expect(bcom).toMatchObject({ bookings: 2, owed: 12750, received: 8500, variance: 4250 });
    expect(bcom.payouts).toHaveLength(1);
  });

  it("negative variance flags an overpayment / mismatch", () => {
    const rows = reconcilePayouts(
      channels,
      [{ channelId: "agoda", owed: 5000 }],
      [{ id: "p2", channelId: "agoda", amount: 6000, paidAt: "2026-07-02", reference: "TXN9", note: null }],
    );
    expect(rows.find((r) => r.channelId === "agoda")!.variance).toBe(-1000);
  });

  it("omits OTA-collect channels with neither bookings nor payouts", () => {
    const rows = reconcilePayouts(channels, [{ channelId: "bcom", owed: 100 }], []);
    expect(rows.map((r) => r.channelId)).toEqual(["bcom"]);
  });

  it("ignores payouts/bookings on unknown (non-collect) channels", () => {
    const rows = reconcilePayouts(
      channels,
      [{ channelId: "direct", owed: 9999 }],
      [{ id: "p3", channelId: "direct", amount: 9999, paidAt: "2026-07-03", reference: null, note: null }],
    );
    expect(rows).toHaveLength(0);
  });
});

// ─── Integration: record → reconcile → delete ────────────────────────────────

const STAMP = Date.now();
let rtId: string, roomId: string, guestId: string, channelId: string;
const req = (body: unknown) => new Request("http://localhost/payouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeAll(async () => {
  __resetTenantResolution();
  const rt = await prisma.roomType.create({ data: { name: `pay-${STAMP}-t`, baseRate: 2000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 6000 } });
  rtId = rt.id;
  const [room, guest, channel] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: rt.id, label: `pay-${STAMP}-A` } }),
    prisma.guest.create({ data: { name: `pay-${STAMP}-g`, phone: `pay-${STAMP}` } }),
    // An OTA-collect channel at 15% commission.
    prisma.channel.create({ data: { name: `pay-${STAMP}-OTA`, commissionPct: 15, collectsPayment: true } }),
  ]);
  roomId = room.id; guestId = guest.id; channelId = channel.id;
  // One confirmed booking: gross 10000 → net owed 8500.
  await prisma.reservation.create({ data: { roomId, guestId, channelId, checkIn: new Date("2027-12-01"), checkOut: new Date("2027-12-03"), grossAmount: 10000 } });
});

afterAll(async () => {
  await prisma.payout.deleteMany({ where: { channelId } });
  await prisma.reservation.deleteMany({ where: { roomId } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.roomType.deleteMany({ where: { id: rtId } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

// Only this channel's row (avoids coupling to other seed channels in the shared DB).
const mine = (rows: Awaited<ReturnType<typeof getPayoutReconciliation>>) => rows.find((r) => r.channelId === channelId);

describe("payout reconciliation (GAP-13/US-405)", () => {
  it("shows the full net as owed before any payout", async () => {
    const row = mine(await getPayoutReconciliation());
    expect(row).toMatchObject({ bookings: 1, owed: 8500, received: 0, variance: 8500 });
  });

  it("recording a payout reduces the variance, and it clears once fully settled", async () => {
    const res = await createPayout(req({ channelId, amount: 8500, paidAt: "2027-12-20", reference: "STMT-1" }));
    expect(res.status).toBe(201);
    const row = mine(await getPayoutReconciliation());
    expect(row).toMatchObject({ received: 8500, variance: 0 });
    expect(row!.payouts).toHaveLength(1);
  });

  it("rejects a payout on a non-OTA-collect channel", async () => {
    const direct = await prisma.channel.create({ data: { name: `pay-${STAMP}-DIRECT`, commissionPct: 0, collectsPayment: false } });
    const res = await createPayout(req({ channelId: direct.id, amount: 100, paidAt: "2027-12-20" }));
    expect(res.status).toBe(400);
    await prisma.channel.deleteMany({ where: { id: direct.id } });
  });

  it("deleting the payout restores the variance", async () => {
    const payout = await prisma.payout.findFirst({ where: { channelId } });
    const res = await deletePayout(new Request(`http://localhost/payouts/${payout!.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: payout!.id }) });
    expect(res.status).toBe(200);
    expect(mine(await getPayoutReconciliation())!.variance).toBe(8500);
  });
});
