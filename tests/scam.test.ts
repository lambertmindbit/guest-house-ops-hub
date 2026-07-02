import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, __resetTenantResolution } from "@/lib/prisma";
import {
  hashPhone, phoneLast4, isActive, reportScam, verifyScamReport,
  disputeScamReport, sharedScamListFor, lookupScam,
} from "@/lib/community/scam";
import { setGrant } from "@/lib/community/network";

// ─── Pure ───────────────────────────────────────────────────────────────────

describe("hashPhone / phoneLast4", () => {
  it("is format-insensitive and collision-free", () => {
    expect(hashPhone("+91 99988-87777")).toBe(hashPhone("9998887777"));
    expect(hashPhone("9998887777")).not.toBe(hashPhone("9998887778"));
    expect(phoneLast4("+91 99988-87777")).toBe("7777");
  });
});

describe("isActive", () => {
  const now = new Date("2026-07-02");
  it("is true only for verified + unexpired", () => {
    expect(isActive({ status: "verified", expiresAt: null }, now)).toBe(true);
    expect(isActive({ status: "verified", expiresAt: new Date("2026-12-01") }, now)).toBe(true);
    expect(isActive({ status: "verified", expiresAt: new Date("2026-01-01") }, now)).toBe(false);
    expect(isActive({ status: "submitted", expiresAt: null }, now)).toBe(false);
    expect(isActive({ status: "disputed", expiresAt: null }, now)).toBe(false);
  });
});

// ─── DB ─────────────────────────────────────────────────────────────────────

const TAG = `scam-${Date.now()}`;
let R: string; // reporter
let V: string; // viewer

beforeAll(async () => {
  __resetTenantResolution();
  R = (await prisma.propertySettings.create({ data: { name: `${TAG}-R` } })).id;
  V = (await prisma.propertySettings.create({ data: { name: `${TAG}-V` } })).id;
  await prisma.networkConnection.create({ data: { requesterPropertyId: R, addresseePropertyId: V, status: "accepted" } });
});

afterAll(async () => {
  await prisma.sharedScamReport.deleteMany({ where: { reporterPropertyId: { in: [R, V] } } });
  await prisma.sharingGrant.deleteMany({ where: { grantorPropertyId: { in: [R, V] } } });
  await prisma.networkConnection.deleteMany({ where: { requesterPropertyId: { in: [R, V] } } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: [R, V] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("shared scam network", () => {
  it("requires evidence to verify, and only verified+shared reports reach a peer", async () => {
    const noEvidence = await reportScam(R, { phone: "9990001111", reason: "fake payment" });
    expect(noEvidence.ok).toBe(true);
    const badVerify = await verifyScamReport(noEvidence.ok ? noEvidence.id : "", R);
    expect(badVerify.ok).toBe(false); // no evidence note

    const withEvidence = await reportScam(R, { phone: "9998887777", reason: "fake payment", evidenceNote: "screenshot #12" });
    const id = withEvidence.ok ? withEvidence.id : "";
    expect((await verifyScamReport(id, R)).ok).toBe(true);

    // Verified but NOT yet shared with V.
    expect(await sharedScamListFor(V)).toHaveLength(0);

    // Enable scam sharing R→V.
    await setGrant(R, V, "scam", true);
    const shared = await sharedScamListFor(V);
    expect(shared.some((r) => r.id === id)).toBe(true);

    // Lookup by number (hashed) matches for V.
    const matches = await lookupScam(V, "+91 99988-87777");
    expect(matches.some((r) => r.id === id)).toBe(true);

    // A dispute (appeal) by the viewer hides it from sharing.
    expect((await disputeScamReport(id, V)).ok).toBe(true);
    expect((await sharedScamListFor(V)).some((r) => r.id === id)).toBe(false);
  });

  it("excludes expired reports from sharing and lookup", async () => {
    const rep = await reportScam(R, { phone: "9995554444", reason: "chargeback", evidenceNote: "invoice #9" });
    const id = rep.ok ? rep.id : "";
    await verifyScamReport(id, R);
    // Force expiry into the past.
    await prisma.sharedScamReport.update({ where: { id }, data: { expiresAt: new Date("2020-01-01") } });

    expect((await sharedScamListFor(V)).some((r) => r.id === id)).toBe(false);
    expect((await lookupScam(V, "9995554444")).some((r) => r.id === id)).toBe(false);
  });
});
