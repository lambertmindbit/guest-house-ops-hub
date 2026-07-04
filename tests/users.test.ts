import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, __resetTenantResolution } from "@/lib/prisma";
import { isLastActiveOwner } from "@/lib/users";

// Users are not tenant-scoped; the last-owner guard is global. Clean up by a tag.
const TAG = `owners-${Date.now()}`;
const email = (s: string) => `${TAG}-${s}@example.com`;

beforeEach(async () => {
  __resetTenantResolution();
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("isLastActiveOwner", () => {
  it("is true for the only active owner", async () => {
    const o = await prisma.user.create({ data: { email: email("solo"), passwordHash: "x", role: "owner", active: true } });
    expect(await isLastActiveOwner(o.id)).toBe(true);
  });

  it("is false when another active owner exists", async () => {
    const o1 = await prisma.user.create({ data: { email: email("a"), passwordHash: "x", role: "owner", active: true } });
    await prisma.user.create({ data: { email: email("b"), passwordHash: "x", role: "owner", active: true } });
    expect(await isLastActiveOwner(o1.id)).toBe(false);
  });

  it("ignores disabled owners (a disabled co-owner doesn't count)", async () => {
    const o1 = await prisma.user.create({ data: { email: email("act"), passwordHash: "x", role: "owner", active: true } });
    await prisma.user.create({ data: { email: email("dis"), passwordHash: "x", role: "owner", active: false } });
    expect(await isLastActiveOwner(o1.id)).toBe(true);
  });

  it("is false for a non-owner", async () => {
    const u = await prisma.user.create({ data: { email: email("recep"), passwordHash: "x", role: "reception", active: true } });
    expect(await isLastActiveOwner(u.id)).toBe(false);
  });
});
