import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

// BR-GST-05: a new property defaults to a 180-day ID-scan retention window, while
// the owner can still opt into indefinite retention or a custom window.

const TAG = `retdef-${Date.now()}`;

afterAll(async () => {
  await prisma.propertySettings.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("idRetentionDays default (BR-GST-05)", () => {
  it("defaults a newly-created property to 180 days", async () => {
    const p = await prisma.propertySettings.create({ data: { name: `${TAG}-a` } });
    expect(p.idRetentionDays).toBe(180);
  });

  it("still allows indefinite retention when explicitly blanked", async () => {
    const p = await prisma.propertySettings.create({ data: { name: `${TAG}-b`, idRetentionDays: null } });
    expect(p.idRetentionDays).toBeNull();
  });

  it("honours an explicit custom window", async () => {
    const p = await prisma.propertySettings.create({ data: { name: `${TAG}-c`, idRetentionDays: 90 } });
    expect(p.idRetentionDays).toBe(90);
  });
});
