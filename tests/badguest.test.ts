import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, __resetTenantResolution } from "@/lib/prisma";
import {
  maskName, isActive, reportGuestAlert, verifyGuestAlert, disputeGuestAlert,
  sharedGuestAlertsFor, lookupGuestAlert,
} from "@/lib/community/badguest";
import { setGrant } from "@/lib/community/network";

// ─── Pure ───────────────────────────────────────────────────────────────────

describe("maskName / isActive", () => {
  it("keeps only the first name", () => {
    expect(maskName("Riya Sharma")).toBe("Riya");
    expect(maskName("  Anil   Kumar  ")).toBe("Anil");
  });
  it("is active only for verified + unexpired", () => {
    const now = new Date("2026-07-02");
    expect(isActive({ status: "verified", expiresAt: null }, now)).toBe(true);
    expect(isActive({ status: "verified", expiresAt: new Date("2026-01-01") }, now)).toBe(false);
    expect(isActive({ status: "submitted", expiresAt: null }, now)).toBe(false);
  });
});

// ─── DB ─────────────────────────────────────────────────────────────────────

const TAG = `bg-${Date.now()}`;
let R: string;
let V: string;

beforeAll(async () => {
  __resetTenantResolution();
  R = (await prisma.propertySettings.create({ data: { name: `${TAG}-R` } })).id;
  V = (await prisma.propertySettings.create({ data: { name: `${TAG}-V` } })).id;
  await prisma.networkConnection.create({ data: { requesterPropertyId: R, addresseePropertyId: V, status: "accepted" } });
});

afterAll(async () => {
  await prisma.sharedGuestAlert.deleteMany({ where: { reporterPropertyId: { in: [R, V] } } });
  await prisma.sharingGrant.deleteMany({ where: { grantorPropertyId: { in: [R, V] } } });
  await prisma.networkConnection.deleteMany({ where: { requesterPropertyId: { in: [R, V] } } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: [R, V] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("shared bad-guest alerts", () => {
  it("requires evidence to verify, and only verified + shared alerts reach a peer", async () => {
    const noEvidence = await reportGuestAlert(R, { phone: "9990001111", guestName: "Mo Trouble", category: "damage", reason: "broke a geyser" });
    expect(noEvidence.ok).toBe(true);
    expect((await verifyGuestAlert(noEvidence.ok ? noEvidence.id : "", R)).ok).toBe(false);

    const withEvidence = await reportGuestAlert(R, { phone: "9998887777", guestName: "Bad Actor", category: "threat", reason: "threatened staff", evidenceNote: "CCTV clip #4" });
    const id = withEvidence.ok ? withEvidence.id : "";
    expect((await verifyGuestAlert(id, R)).ok).toBe(true);

    expect(await sharedGuestAlertsFor(V)).toHaveLength(0); // not shared yet

    await setGrant(R, V, "bad_guest", true);
    const shared = await sharedGuestAlertsFor(V);
    expect(shared.some((a) => a.id === id)).toBe(true);
    // Only the masked first name + last 4 are shared.
    const view = shared.find((a) => a.id === id)!;
    expect(view.guestNameMasked).toBe("Bad");
    expect(view.guestPhoneLast4).toBe("7777");

    expect((await lookupGuestAlert(V, "+91 99988 87777")).some((a) => a.id === id)).toBe(true);

    expect((await disputeGuestAlert(id, V)).ok).toBe(true);
    expect((await sharedGuestAlertsFor(V)).some((a) => a.id === id)).toBe(false);
  });

  it("excludes expired alerts", async () => {
    const rep = await reportGuestAlert(R, { phone: "9995554444", category: "disturbance", reason: "loud parties", evidenceNote: "noise complaint" });
    const id = rep.ok ? rep.id : "";
    await verifyGuestAlert(id, R);
    await prisma.sharedGuestAlert.update({ where: { id }, data: { expiresAt: new Date("2020-01-01") } });
    expect((await sharedGuestAlertsFor(V)).some((a) => a.id === id)).toBe(false);
    expect((await lookupGuestAlert(V, "9995554444")).some((a) => a.id === id)).toBe(false);
  });
});
