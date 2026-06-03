import { prisma } from "@/lib/prisma";
import { parseBookingEmail } from "@/lib/email-parse";
import { parseDateOnly } from "@/lib/dates";

// Parse a raw OTA email and stage it for review. Dedupes on otaRef so the same
// confirmation arriving twice (e.g. re-forwarded, or a webhook retry) doesn't
// create duplicate review items.
export async function ingestEmail(raw: string) {
  const p = parseBookingEmail(raw);

  if (p.otaRef) {
    const existing = await prisma.inboundBooking.findFirst({
      where: { otaRef: p.otaRef, status: { in: ["pending", "imported"] } },
    });
    if (existing) return existing;
  }

  return prisma.inboundBooking.create({
    data: {
      source: p.source,
      otaRef: p.otaRef,
      rawText: raw,
      guestName: p.guestName,
      guestPhone: p.guestPhone,
      checkIn: p.checkIn ? parseDateOnly(p.checkIn) : null,
      checkOut: p.checkOut ? parseDateOnly(p.checkOut) : null,
      roomTypeHint: p.roomTypeHint,
      amount: p.amount ?? undefined,
    },
  });
}
