import { prisma } from "@/lib/prisma";
import { parseBookingEmail } from "@/lib/email-parse";
import { parseDateOnly } from "@/lib/dates";
import { redactCardNumbers } from "@/lib/redact";

// Parse a raw OTA email and stage it for review. Dedupes on otaRef (US-305): the
// same confirmation arriving twice — re-forwarded, or a webhook retry — must never
// stage a second create. A re-send is matched against BOTH an existing reservation
// (the booking was already made from this ref) and a pending/imported staging item,
// and is recorded as `duplicate` rather than a new pending review item.
export async function ingestEmail(raw: string) {
  // Parse the ORIGINAL (card numbers aren't parsed fields), but persist a redacted
  // body — a card / virtual-card number must never be stored (US-306).
  const p = parseBookingEmail(raw);

  const commonData = {
    source: p.source,
    otaRef: p.otaRef,
    rawText: redactCardNumbers(raw),
    guestName: p.guestName,
    guestPhone: p.guestPhone,
    checkIn: p.checkIn ? parseDateOnly(p.checkIn) : null,
    checkOut: p.checkOut ? parseDateOnly(p.checkOut) : null,
    roomTypeHint: p.roomTypeHint,
    amount: p.amount ?? undefined,
  };

  // GAP-2: a modification/cancellation for an EXISTING booking is not a duplicate.
  // Match it to the reservation and stage it (linked) for the operator to review a
  // field-level diff and Apply through the normal conflict-checked path. A new
  // confirmation falls through to the dedup + staging below.
  if (p.otaRef && p.kind !== "new") {
    const reservation = await prisma.reservation.findFirst({ where: { otaRef: p.otaRef }, select: { id: true } });
    if (reservation) {
      const existing = await prisma.inboundBooking.findFirst({ where: { otaRef: p.otaRef, emailKind: p.kind, status: "pending" } });
      return existing ?? prisma.inboundBooking.create({ data: { ...commonData, emailKind: p.kind, reservationId: reservation.id } });
    }
  }

  if (p.otaRef) {
    const [reservation, staged] = await Promise.all([
      prisma.reservation.findFirst({ where: { otaRef: p.otaRef }, select: { id: true } }),
      prisma.inboundBooking.findFirst({
        where: { otaRef: p.otaRef, status: { in: ["pending", "imported"] } },
        select: { id: true },
      }),
    ]);
    if (reservation || staged) {
      // Already known → flag the re-send as a duplicate, don't stage a new create.
      // Only record it once so webhook-retry storms can't pile up rows.
      const existingDup = await prisma.inboundBooking.findFirst({
        where: { otaRef: p.otaRef, status: "duplicate" },
      });
      return existingDup ?? prisma.inboundBooking.create({ data: { ...commonData, status: "duplicate" } });
    }
  }

  return prisma.inboundBooking.create({ data: commonData });
}
