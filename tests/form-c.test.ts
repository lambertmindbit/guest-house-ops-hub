import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The submit route audits via recordAudit → getSession → cookies() (throws in tests).
vi.mock("@/lib/session", () => ({ getSession: async () => null }));

import { prisma } from "@/lib/prisma";
import { POST as submitFormC } from "@/app/api/reservations/[id]/form-c/route";
import { isForeignGuest, formCStatus, formCReminderDue } from "@/lib/form-c";

const NOW = new Date("2026-07-19T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe("isForeignGuest (nationality-driven)", () => {
  it("blank or Indian is domestic; anything else is foreign", () => {
    expect(isForeignGuest(null)).toBe(false);
    expect(isForeignGuest("")).toBe(false);
    expect(isForeignGuest("Indian")).toBe(false);
    expect(isForeignGuest("India")).toBe(false);
    expect(isForeignGuest("British")).toBe(true);
    expect(isForeignGuest("German")).toBe(true);
  });
});

describe("formCStatus", () => {
  it("applies + overdue for a foreign guest checked in >24h ago, unsubmitted", () => {
    const s = formCStatus({ nationality: "British", checkedInAt: hoursAgo(30), formCSubmittedAt: null }, NOW);
    expect(s).toMatchObject({ applies: true, submitted: false, overdue: true });
    expect(Math.round(s.hoursSinceCheckIn!)).toBe(30);
  });
  it("is not overdue within the 24h window", () => {
    expect(formCStatus({ nationality: "British", checkedInAt: hoursAgo(5), formCSubmittedAt: null }, NOW).overdue).toBe(false);
  });
  it("submitted clears the reminder/overdue", () => {
    const s = formCStatus({ nationality: "British", checkedInAt: hoursAgo(30), formCSubmittedAt: NOW }, NOW);
    expect(s.submitted).toBe(true);
    expect(s.overdue).toBe(false);
  });
  it("a domestic guest never applies", () => {
    expect(formCStatus({ nationality: "Indian", checkedInAt: NOW, formCSubmittedAt: null }, NOW).applies).toBe(false);
  });
  it("reminder is due for a checked-in foreign guest until submitted", () => {
    expect(formCReminderDue({ nationality: "British", checkedInAt: hoursAgo(2), formCSubmittedAt: null })).toBe(true);
    expect(formCReminderDue({ nationality: "British", checkedInAt: null, formCSubmittedAt: null })).toBe(false);
    expect(formCReminderDue({ nationality: "British", checkedInAt: hoursAgo(2), formCSubmittedAt: NOW })).toBe(false);
  });
});

// Integration: the submit endpoint sets/clears the flag and audits.
const STAMP = Date.now();
let roomId: string;
let guestId: string;
let channelId: string;
let resId: string;
const req = (body: unknown) => new Request("http://localhost/form-c", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  const rt = await prisma.roomType.create({ data: { name: `formc-${STAMP}-t`, baseRate: 2000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 6000 } });
  const [room, guest, channel] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: rt.id, label: `formc-${STAMP}-A` } }),
    prisma.guest.create({ data: { name: `formc-${STAMP}-g`, phone: `formc-${STAMP}`, nationality: "British" } }),
    prisma.channel.create({ data: { name: `formc-${STAMP}-c`, commissionPct: 0, collectsPayment: false } }),
  ]);
  roomId = room.id; guestId = guest.id; channelId = channel.id;
  const r = await prisma.reservation.create({ data: { roomId, guestId, channelId, checkIn: new Date("2027-11-10"), checkOut: new Date("2027-11-12"), checkedInAt: new Date() } });
  resId = r.id;
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { entityId: resId } });
  await prisma.reservation.deleteMany({ where: { id: resId } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { name: `formc-${STAMP}-t` } });
  await prisma.channel.deleteMany({ where: { name: `formc-${STAMP}-c` } });
  await prisma.$disconnect();
});

describe("Form C submit endpoint (GAP-7)", () => {
  it("marks Form C submitted (sets the timestamp + audits) and un-marks it", async () => {
    const res = await submitFormC(req({ submitted: true }), params(resId));
    expect(res.status).toBe(200);
    expect((await prisma.reservation.findUnique({ where: { id: resId } }))?.formCSubmittedAt).not.toBeNull();
    expect(await prisma.auditEvent.findFirst({ where: { action: "form-c.submit", entityId: resId } })).toBeTruthy();

    await submitFormC(req({ submitted: false }), params(resId));
    expect((await prisma.reservation.findUnique({ where: { id: resId } }))?.formCSubmittedAt).toBeNull();
  });
});
