import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ID-document view needs storage to "exist" so the handler reaches the audit line.
vi.mock("@/lib/storage", () => ({
  isStorageConfigured: () => true,
  signedUrl: async () => "https://example.test/signed",
  uploadObject: async () => {},
  deleteObject: async () => {},
}));

// recordAudit reads the session via cookies(), which throws outside a request
// context (vitest). In production the call runs inside a request; here we stub the
// session so the audit write — the thing under test — actually happens.
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  getSession: async () => null,
}));

import { prisma } from "@/lib/prisma";
import { POST as createPayment } from "@/app/api/reservations/[id]/payments/route";
import { DELETE as deletePayment } from "@/app/api/payments/[id]/route";
import { PATCH as patchSettings } from "@/app/api/settings/route";
import { POST as setOverride, DELETE as clearOverride } from "@/app/api/pricing/overrides/route";
import { GET as viewIdDoc } from "@/app/api/guests/[id]/id-document/route";

// GAP-15: widen audit coverage. Each new sensitive action must leave an AuditEvent.
const STAMP = Date.now();
let roomTypeId: string;
let roomId: string;
let guestId: string;
let channelId: string;
let reservationId: string;

const json = (body: unknown) =>
  new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const auditExists = (action: string, entityId?: string) =>
  prisma.auditEvent.findFirst({ where: { action, ...(entityId ? { entityId } : {}) } });

beforeAll(async () => {
  const roomType = await prisma.roomType.create({ data: { name: `audit-${STAMP}-t`, baseRate: 2000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 6000 } });
  const [room, guest, channel] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: roomType.id, label: `audit-${STAMP}-A` } }),
    prisma.guest.create({ data: { name: `audit-${STAMP}-g`, phone: `audit-${STAMP}`, idDocumentPath: "fake/id.jpg", idUploaded: true } }),
    prisma.channel.create({ data: { name: `audit-${STAMP}-c`, commissionPct: 0, collectsPayment: false } }),
  ]);
  roomTypeId = roomType.id; roomId = room.id; guestId = guest.id; channelId = channel.id;
  const r = await prisma.reservation.create({ data: { roomId, guestId, channelId, checkIn: new Date("2027-05-10"), checkOut: new Date("2027-05-12"), grossAmount: 5000 } });
  reservationId = r.id;
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { action: { in: ["payment.create", "payment.delete", "settings.update", "pricing.override.set", "pricing.override.clear", "id.document.view"] }, createdAt: { gte: new Date(STAMP) } } });
  await prisma.payment.deleteMany({ where: { reservationId } });
  await prisma.rateOverride.deleteMany({ where: { roomTypeId } });
  await prisma.reservation.deleteMany({ where: { id: reservationId } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.$disconnect();
});

describe("audit coverage (GAP-15)", () => {
  it("audits a payment create and delete", async () => {
    const res = await createPayment(json({ amount: 1000, mode: "cash" }), params(reservationId));
    expect(res.status).toBe(201);
    const payment = (await res.json()).data;
    expect(await auditExists("payment.create", payment.id)).toBeTruthy();

    await deletePayment(json({}), params(payment.id));
    expect(await auditExists("payment.delete", payment.id)).toBeTruthy();
  });

  it("audits a settings change", async () => {
    const res = await patchSettings(json({ currency: "INR" }));
    expect(res.status).toBe(200);
    const settings = (await res.json()).data;
    expect(await auditExists("settings.update", settings.id)).toBeTruthy();
  });

  it("audits a rate override set and clear", async () => {
    const set = await setOverride(json({ roomTypeId, date: "2027-05-11", rate: 3200 }));
    expect(set.status).toBe(201);
    expect(await auditExists("pricing.override.set")).toBeTruthy();

    await clearOverride(json({ roomTypeId, date: "2027-05-11" }));
    expect(await auditExists("pricing.override.clear")).toBeTruthy();
  });

  it("audits an ID-document view/download", async () => {
    const res = await viewIdDoc(json({}), params(guestId));
    expect(res.status).toBe(200);
    expect(await auditExists("id.document.view", guestId)).toBeTruthy();
  });
});
