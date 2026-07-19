import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ingestEmail } from "@/lib/inbound";

// US-306 integration: a card number present in a raw OTA email must not survive
// into storage — while the parse (which uses the original) still works.

const STAMP = Date.now();
const REF = `8814${STAMP}`;

afterAll(async () => {
  await prisma.inboundBooking.deleteMany({ where: { otaRef: REF } });
  await prisma.$disconnect();
});

describe("ingestEmail redaction (US-306)", () => {
  it("stores the body with the card number redacted, ref still parsed", async () => {
    const raw = [
      "Your booking is confirmed — Booking.com",
      `Booking number: ${REF}`,
      "Guest name: Card Holder",
      "Card: 4111 1111 1111 1111",
      "Check-in: Friday, 12 July 2026",
      "Check-out: Sunday, 14 July 2026",
    ].join("\n");

    const row = await ingestEmail(raw);

    expect(row.rawText).not.toContain("4111");
    expect(row.rawText).not.toMatch(/\d{13,}/);
    expect(row.rawText).toContain("[redacted card]");
    expect(row.otaRef).toBe(REF); // parsing used the original, so the ref survived
  });
});
