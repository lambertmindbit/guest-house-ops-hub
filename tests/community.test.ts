import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, __resetTenantResolution } from "@/lib/prisma";
import {
  canRead,
  invitePeer,
  respondToInvite,
  setGrant,
  assertCanRead,
  connectionBetween,
} from "@/lib/community/network";
import type { GrantRow } from "@/lib/community/network";

// ─── Pure guard (no DB) ─────────────────────────────────────────────────────

describe("canRead (cross-tenant guard)", () => {
  const A = "propA";
  const B = "propB";
  const grant = (over: Partial<GrantRow> = {}): GrantRow => ({
    grantorPropertyId: A, granteePropertyId: B, dataType: "availability", enabled: true, ...over,
  });
  const base = { grants: [grant()], ownerPropertyId: A, viewerPropertyId: B, type: "availability" as const };

  it("denies when there is no accepted connection", () => {
    expect(canRead({ ...base, connectionStatus: null })).toBe(false);
    expect(canRead({ ...base, connectionStatus: "pending" })).toBe(false);
    expect(canRead({ ...base, connectionStatus: "declined" })).toBe(false);
    expect(canRead({ ...base, connectionStatus: "revoked" })).toBe(false);
  });

  it("allows only with an accepted connection AND an enabled grant of the type", () => {
    expect(canRead({ ...base, connectionStatus: "accepted" })).toBe(true);
  });

  it("denies a disabled grant", () => {
    expect(canRead({ ...base, connectionStatus: "accepted", grants: [grant({ enabled: false })] })).toBe(false);
  });

  it("denies the wrong data type", () => {
    expect(canRead({ ...base, connectionStatus: "accepted", type: "referrals" })).toBe(false);
  });

  it("is directional — a grant A→B does not let A read B", () => {
    expect(canRead({ connectionStatus: "accepted", grants: [grant()], ownerPropertyId: B, viewerPropertyId: A, type: "availability" })).toBe(false);
  });
});

// ─── DB-backed leakage / permission flow ────────────────────────────────────

const TAG = `comm-${Date.now()}`;
let A: string;
let B: string;

beforeAll(async () => {
  __resetTenantResolution();
  A = (await prisma.propertySettings.create({ data: { name: `${TAG}-A` } })).id;
  B = (await prisma.propertySettings.create({ data: { name: `${TAG}-B` } })).id;
});

afterAll(async () => {
  await prisma.sharingGrant.deleteMany({ where: { grantorPropertyId: { in: [A, B] } } });
  await prisma.networkConnection.deleteMany({ where: { requesterPropertyId: { in: [A, B] } } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: [A, B] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("trusted-network flow + default-deny", () => {
  it("rejects self-invites", async () => {
    const r = await invitePeer(A, A);
    expect(r.ok).toBe(false);
  });

  it("default-deny: no data is readable before a connection + grant exist", async () => {
    await expect(assertCanRead(A, B, "availability")).rejects.toThrow();
  });

  it("invite → accept → grant makes exactly the granted type readable, one-way", async () => {
    const invite = await invitePeer(A, B);
    expect(invite.ok).toBe(true);

    const conn = await connectionBetween(A, B);
    expect(conn?.status).toBe("pending");

    // Only the addressee (B) can accept.
    const wrongParty = await respondToInvite(conn!.id, A, "accept");
    expect(wrongParty.ok).toBe(false);
    await respondToInvite(conn!.id, B, "accept");
    expect((await connectionBetween(A, B))?.status).toBe("accepted");

    // A shares availability with B.
    await setGrant(A, B, "availability", true);
    await expect(assertCanRead(A, B, "availability")).resolves.toBeUndefined();

    // Not the un-granted type, and not the reverse direction.
    await expect(assertCanRead(A, B, "referrals")).rejects.toThrow();
    await expect(assertCanRead(B, A, "availability")).rejects.toThrow();

    // Turning the grant off revokes access again.
    await setGrant(A, B, "availability", false);
    await expect(assertCanRead(A, B, "availability")).rejects.toThrow();
  });

  it("cannot share without an accepted connection", async () => {
    // B and a fresh third property have no connection.
    const C = (await prisma.propertySettings.create({ data: { name: `${TAG}-C` } })).id;
    const r = await setGrant(B, C, "availability", true);
    expect(r.ok).toBe(false);
    await prisma.propertySettings.delete({ where: { id: C } });
  });
});
