import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { purgeExpiredIdDocuments } from "@/lib/id-retention";

// Integration: purgeExpiredIdDocuments reads EVERY property's retention window and
// purges shared guests against the STRICTEST one. Guests are owner-wide, so a single
// document is governed by the owner's strictest policy — never kept longer than any
// property permits.
//
// These assert on each test's OWN guest, not the global purged count: the purge is
// DB-wide, and since BR-GST-05 gives new properties a 180-day default, other tests'
// PropertySettings can add windows to the shared DB. A per-guest assertion whose
// outcome is pinned by the window THIS test creates stays deterministic regardless.
// (The "null strictest ⇒ no-op" branch is covered purely in id-retention.test.ts.)

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
  it("purges an ID older than the STRICTEST window, even though a laxer property would keep it", async () => {
    await prisma.propertySettings.create({ data: { name: "RETTEST-strict", idRetentionDays: 90 } });
    await prisma.propertySettings.create({ data: { name: "RETTEST-lax", idRetentionDays: 180 } });
    // Scanned 100 days ago: past the strict 90-day window, within the lax 180.
    const g = await prisma.guest.create({
      data: { name: "RetGuest", phone: "RETTEST-1", idDocumentPath: "x/id.jpg", idUploaded: true, idUploadedAt: daysAgo(100) },
    });

    await purgeExpiredIdDocuments();

    const after = await prisma.guest.findUnique({ where: { id: g.id }, select: { idDocumentPath: true, idUploaded: true } });
    expect(after?.idDocumentPath).toBeNull(); // purged under the strict window
    expect(after?.idUploaded).toBe(false);
  });

  it("purges an ID past a single property's own window", async () => {
    await prisma.propertySettings.create({ data: { name: "RETTEST-solo", idRetentionDays: 180 } });
    const old = await prisma.guest.create({
      data: { name: "Old", phone: "RETTEST-old", idDocumentPath: "o/id.jpg", idUploaded: true, idUploadedAt: daysAgo(200) },
    });

    await purgeExpiredIdDocuments();

    expect((await prisma.guest.findUnique({ where: { id: old.id } }))?.idDocumentPath).toBeNull();
  });

  it("keeps an ID that is still within the window", async () => {
    await prisma.propertySettings.create({ data: { name: "RETTEST-solo2", idRetentionDays: 180 } });
    const fresh = await prisma.guest.create({
      data: { name: "Fresh", phone: "RETTEST-fresh", idDocumentPath: "f/id.jpg", idUploaded: true, idUploadedAt: daysAgo(10) },
    });

    await purgeExpiredIdDocuments();

    expect((await prisma.guest.findUnique({ where: { id: fresh.id } }))?.idDocumentPath).toBe("f/id.jpg");
  });
});
