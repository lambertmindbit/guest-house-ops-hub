import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import { matchesFilters, searchDirectory, type DirectoryEntry } from "@/lib/community/directory";

// ─── Pure filter (no DB) ────────────────────────────────────────────────────

const entry = (over: Partial<DirectoryEntry> = {}): DirectoryEntry => ({
  propertyId: "p1", name: "Peer", locality: null, bio: null, priceBand: "budget",
  amenities: ["Parking", "Wi-Fi"], photoPaths: [], connected: false, contactPhone: null, ...over,
});

describe("matchesFilters", () => {
  it("passes with no filters", () => {
    expect(matchesFilters(entry(), {})).toBe(true);
  });
  it("matches a need case-insensitively by substring", () => {
    expect(matchesFilters(entry(), { needs: ["parking"] })).toBe(true);
    expect(matchesFilters(entry({ amenities: ["Free Parking"] }), { needs: ["parking"] })).toBe(true);
  });
  it("fails when a need is absent", () => {
    expect(matchesFilters(entry(), { needs: ["Pets"] })).toBe(false);
  });
  it("requires ALL needs (AND)", () => {
    expect(matchesFilters(entry(), { needs: ["Parking", "Wi-Fi"] })).toBe(true);
    expect(matchesFilters(entry(), { needs: ["Parking", "Pets"] })).toBe(false);
  });
  it("matches priceBand exactly", () => {
    expect(matchesFilters(entry(), { priceBand: "budget" })).toBe(true);
    expect(matchesFilters(entry(), { priceBand: "premium" })).toBe(false);
  });
});

// ─── DB-backed discovery + contact-phone gating ─────────────────────────────

const TAG = `dir-${Date.now()}`;
let viewer: string;
let discoverable: string;
let hidden: string;

beforeAll(async () => {
  __resetTenantResolution();
  viewer = (await prisma.propertySettings.create({ data: { name: `${TAG}-viewer` } })).id;
  discoverable = (await prisma.propertySettings.create({
    data: { name: `${TAG}-open`, publicName: `${TAG} Orchid`, isDiscoverable: true, contactPhone: "9990001111", priceBand: "budget" },
  })).id;
  hidden = (await prisma.propertySettings.create({
    data: { name: `${TAG}-hidden`, isDiscoverable: false, contactPhone: "8880002222" },
  })).id;
  await prismaForTenant(discoverable).amenity.create({ data: { name: "Parking" } });
});

afterAll(async () => {
  const ids = [viewer, discoverable, hidden];
  await prisma.amenity.deleteMany({ where: { propertyId: { in: ids } } });
  await prisma.networkConnection.deleteMany({ where: { requesterPropertyId: { in: ids } } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: ids } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("searchDirectory", () => {
  it("lists discoverable peers, hides non-discoverable, and withholds contact until connected", async () => {
    const before = await searchDirectory(viewer);
    const open = before.find((e) => e.propertyId === discoverable);
    expect(open).toBeTruthy();
    expect(open!.contactPhone).toBeNull(); // not connected yet
    expect(before.some((e) => e.propertyId === hidden)).toBe(false); // never surfaced

    // Connect the two, accepted → contact phone becomes visible.
    await prisma.networkConnection.create({
      data: { requesterPropertyId: viewer, addresseePropertyId: discoverable, status: "accepted" },
    });
    const after = await searchDirectory(viewer);
    expect(after.find((e) => e.propertyId === discoverable)!.contactPhone).toBe("9990001111");
  });

  it("applies amenity filters against peer amenities", async () => {
    expect((await searchDirectory(viewer, { needs: ["Parking"] })).some((e) => e.propertyId === discoverable)).toBe(true);
    expect((await searchDirectory(viewer, { needs: ["Pets"] })).some((e) => e.propertyId === discoverable)).toBe(false);
  });
});
