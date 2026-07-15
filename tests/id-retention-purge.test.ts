import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { purgeExpiredIdDocuments } from "@/lib/id-retention";

// Integration: purgeExpiredIdDocuments reads EVERY property's retention window and
// purges shared guests against the strictest one. Guests are owner-wide, so a single
// document is governed by the owner's strictest policy — never kept longer than any
// property permits.

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const clean = () =>
  Promise.all([
    prisma.guest.deleteMany({ where: { phone: { startsWith: "RETTEST-" } } }),
    prisma.propertySettings.deleteMany({ where: { name: { startsWith: "RETTEST-" } } }),
  ]);

beforeEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe("purgeExpiredIdDocuments across properties", () => {
  it("purges an ID older than the STRICTEST window, even if a laxer property would keep it", async () => {
    await prisma.propertySettings.create({ data: { name: "RETTEST-strict", idRetentionDays: 90 } });
    await prisma.propertySettings.create({ data: { name: "RETTEST-lax", idRetentionDays: 180 } });
    // Scanned 100 days ago: past the strict 90-day window, within the lax 180.
    const g = await prisma.guest.create({
      data: { name: "RetGuest", phone: "RETTEST-1", idDocumentPath: "x/id.jpg", idUploaded: true, idUploadedAt: daysAgo(100) },
    });

    const res = await purgeExpiredIdDocuments();

    expect(res.purged).toBe(1);
    const after = await prisma.guest.findUnique({ where: { id: g.id }, select: { idDocumentPath: true, idUploaded: true } });
    expect(after?.idDocumentPath).toBeNull(); // purged under the strict window
    expect(after?.idUploaded).toBe(false);
  });

  it("single property behaves exactly as before — purges past its own window", async () => {
    await prisma.propertySettings.create({ data: { name: "RETTEST-solo", idRetentionDays: 180 } });
    const old = await prisma.guest.create({
      data: { name: "Old", phone: "RETTEST-old", idDocumentPath: "o/id.jpg", idUploaded: true, idUploadedAt: daysAgo(200) },
    });
    const fresh = await prisma.guest.create({
      data: { name: "Fresh", phone: "RETTEST-fresh", idDocumentPath: "f/id.jpg", idUploaded: true, idUploadedAt: daysAgo(10) },
    });

    const res = await purgeExpiredIdDocuments();

    expect(res.purged).toBe(1); // only the 200-day-old one
    expect((await prisma.guest.findUnique({ where: { id: old.id } }))?.idDocumentPath).toBeNull();
    expect((await prisma.guest.findUnique({ where: { id: fresh.id } }))?.idDocumentPath).toBe("f/id.jpg");
  });

  it("purges nothing when no property sets a window (keep indefinitely)", async () => {
    await prisma.propertySettings.create({ data: { name: "RETTEST-nowindow" } }); // idRetentionDays null
    const g = await prisma.guest.create({
      data: { name: "Kept", phone: "RETTEST-keep", idDocumentPath: "k/id.jpg", idUploaded: true, idUploadedAt: daysAgo(9999) },
    });

    const res = await purgeExpiredIdDocuments();

    expect(res.purged).toBe(0);
    expect((await prisma.guest.findUnique({ where: { id: g.id } }))?.idDocumentPath).toBe("k/id.jpg");
  });
});
