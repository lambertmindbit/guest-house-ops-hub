import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { prisma, __resetTenantResolution } from "@/lib/prisma";
import { hashPhone, hashPhoneCandidates, currentHashVersion, normalizePhone } from "@/lib/community/scam";
import { reportScam, verifyScamReport, lookupScam } from "@/lib/community/scam";
import { setGrant } from "@/lib/community/network";

// US-605: shared scam / bad-guest phones are matched by hash. A plain SHA-256 of a
// 10-digit number is trivially enumerable, so a per-network pepper switches new
// rows to a keyed HMAC. Old SHA-256 rows can't be re-keyed (the number was never
// stored), so matching dual-reads both. These prove that seam.

const sha = (p: string) => createHash("sha256").update(normalizePhone(p)).digest("hex");
const hmac = (p: string, key: string) => createHmac("sha256", key).update(normalizePhone(p)).digest("hex");

afterEach(() => vi.unstubAllEnvs());

describe("keyed hashing (pure)", () => {
  it("no pepper → legacy SHA-256, version 1, single candidate", () => {
    vi.stubEnv("COMMUNITY_HASH_PEPPER", ""); // empty = treated as unset
    expect(hashPhone("+91 99988-87777")).toBe(sha("9998887777"));
    expect(currentHashVersion()).toBe(1);
    expect(hashPhoneCandidates("9998887777")).toEqual([sha("9998887777")]);
  });

  it("pepper set → keyed HMAC, version 2, and it is NOT the plain SHA-256", () => {
    vi.stubEnv("COMMUNITY_HASH_PEPPER", "network-secret");
    const h = hashPhone("9998887777");
    expect(h).toBe(hmac("9998887777", "network-secret"));
    expect(h).not.toBe(sha("9998887777")); // enumeration-resistant: pepper needed to precompute
    expect(currentHashVersion()).toBe(2);
  });

  it("different peppers → different hashes for the same number", () => {
    vi.stubEnv("COMMUNITY_HASH_PEPPER", "pepper-A");
    const a = hashPhone("9998887777");
    vi.stubEnv("COMMUNITY_HASH_PEPPER", "pepper-B");
    expect(hashPhone("9998887777")).not.toBe(a);
  });

  it("candidates cover BOTH schemes when a pepper is set (dual-read for un-rekeyable v1 rows)", () => {
    vi.stubEnv("COMMUNITY_HASH_PEPPER", "network-secret");
    expect(hashPhoneCandidates("9998887777")).toEqual([
      hmac("9998887777", "network-secret"),
      sha("9998887777"),
    ]);
  });
});

// ─── DB: a v1 row stays matchable after the pepper is introduced ──────────────

const TAG = `pepper-${Date.now()}`;
let R: string; // reporter
let V: string; // viewer

beforeAll(async () => {
  __resetTenantResolution();
  R = (await prisma.propertySettings.create({ data: { name: `${TAG}-R` } })).id;
  V = (await prisma.propertySettings.create({ data: { name: `${TAG}-V` } })).id;
  await prisma.networkConnection.create({ data: { requesterPropertyId: R, addresseePropertyId: V, status: "accepted" } });
  await setGrant(R, V, "scam", true);
});

afterAll(async () => {
  await prisma.sharedScamReport.deleteMany({ where: { reporterPropertyId: { in: [R, V] } } });
  await prisma.sharingGrant.deleteMany({ where: { grantorPropertyId: { in: [R, V] } } });
  await prisma.networkConnection.deleteMany({ where: { requesterPropertyId: { in: [R, V] } } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: [R, V] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("hash-version migration (dual-read)", () => {
  it("a legacy SHA-256 report still matches once a pepper is switched on; new reports use HMAC v2", async () => {
    const OLD = "9990001111";
    const NEW = "9992223333";

    // 1. Write OLD with NO pepper → stored as SHA-256, version 1.
    vi.stubEnv("COMMUNITY_HASH_PEPPER", "");
    const oldRep = await reportScam(R, { phone: OLD, reason: "chargeback", evidenceNote: "inv #1" });
    const oldId = oldRep.ok ? oldRep.id : "";
    await verifyScamReport(oldId, R);
    const oldRow = await prisma.sharedScamReport.findUnique({ where: { id: oldId } });
    expect(oldRow?.hashVersion).toBe(1);
    expect(oldRow?.phoneHash).toBe(sha(OLD));

    // 2. Turn the pepper on. New writes use HMAC v2; the old row is untouched.
    vi.stubEnv("COMMUNITY_HASH_PEPPER", "network-secret");
    const newRep = await reportScam(R, { phone: NEW, reason: "fake payment", evidenceNote: "inv #2" });
    const newId = newRep.ok ? newRep.id : "";
    await verifyScamReport(newId, R);
    const newRow = await prisma.sharedScamReport.findUnique({ where: { id: newId } });
    expect(newRow?.hashVersion).toBe(2);
    expect(newRow?.phoneHash).toBe(hmac(NEW, "network-secret"));

    // 3. Both are found by lookup while the pepper is on (candidates dual-read).
    expect((await lookupScam(V, OLD)).some((r) => r.id === oldId)).toBe(true);
    expect((await lookupScam(V, NEW)).some((r) => r.id === newId)).toBe(true);
  });
});
