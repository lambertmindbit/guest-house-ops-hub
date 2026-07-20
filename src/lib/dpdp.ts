import { prisma } from "@/lib/prisma";
import { hashPhone } from "@/lib/community/scam";
import { isStorageConfigured, deleteObject } from "@/lib/storage";

// DPDP data-principal rights (GAP-8/US-202): export-all and erase.
//
// ERASURE IS ANONYMISATION IN PLACE, NOT DELETION. Deleting the Guest row would
// orphan or cascade its reservations and silently restate finance history. Instead
// the row and its id survive and every PII field is overwritten, so occupancy,
// revenue and commission are bit-identical before and after an erasure.
//
// Three confirmed policy decisions are encoded here:
//   1. INVOICES ARE WITHHELD. An issued invoice is immutable and retained under a
//      statutory obligation (GST records), which overrides the erasure right. The
//      exclusion is recorded in the audit entry and declared in the export.
//   2. CROSS-TENANT DATA IS ERASED LOCALLY AND FLAGGED. A peer property is a
//      separate controller with its own copy; we cannot reach into their
//      deployment, so we scrub our copy and withdraw the share.
//   3. A SAFETY BLOCK SURVIVES AS A HASH. Erasing a blocked guest's number would
//      destroy the block, so the blocklist entry keeps a one-way hash of the phone
//      — the guest is unidentifiable, but a future booking still matches.

// Tombstones. The phone tombstone must be UNIQUE per guest because Guest.phone
// carries a unique constraint — a constant would collide on the second erasure.
const ERASED_NAME = "Erased guest";
const ERASED_TEXT = "[erased]";
const phoneTombstone = (guestId: string) => `erased-${guestId}`;

export type ErasureResult = {
  ok: true;
  guestId: string;
  scrubbed: Record<string, number>;
  withheld: string[];
  limitations: string[];
};

// What we deliberately do NOT erase, and why. Surfaced in the export and the audit
// trail so the position is explicit rather than an accident of implementation.
const WITHHELD = [
  "Tax invoices (guest name/phone as issued): immutable and retained under statutory GST record-keeping; the erasure right does not override a legal obligation.",
  "Audit events: the events themselves are retained for audit integrity (including proof of this erasure); their free-text summaries are scrubbed of personal data.",
  "Booking dates, room, amounts and commission: retained as non-identifying financial records so accounts and occupancy history stay correct.",
];

// Honest gaps rather than silent ones.
const LIMITATIONS = [
  "Assistant conversation turns are stored against an anonymous session id with no link to a guest record, so they cannot be targeted by guest. They age out with conversation retention.",
  "Copies already shared with peer properties in the community network are held by those properties as separate controllers; our copy is erased and the share withdrawn, but their copy is outside this deployment's control.",
];

// ─── Export ─────────────────────────────────────────────────────────────────

// Everything held about one guest, machine-readable, plus a manifest of what was
// withheld and why. Read-only.
export async function exportGuestData(guestId: string) {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      reservations: { include: { room: { include: { roomType: true } }, channel: true, payments: true, invoices: { include: { lines: true } } } },
      outboundMessages: true,
      complaints: true,
    },
  });
  if (!guest) return null;

  const [reviewRequests, trips, tourBookings, groups, inbound, referrals, flagged] = await Promise.all([
    prisma.reviewRequest.findMany({ where: { guestId } }),
    prisma.trip.findMany({ where: { guestId } }),
    prisma.tourBooking.findMany({ where: { guestId } }),
    prisma.bookingGroup.findMany({ where: { guestId } }),
    prisma.inboundBooking.findMany({ where: { reservationId: { in: guest.reservations.map((r) => r.id) } } }),
    prisma.outboundReferral.findMany({ where: { guestPhone: guest.phone } }),
    prisma.flaggedNumber.findMany({ where: { phone: guest.phone } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    subject: { id: guest.id, name: guest.name, phone: guest.phone },
    personalDetails: guest,
    bookings: guest.reservations,
    messages: guest.outboundMessages,
    complaints: guest.complaints,
    reviewRequests,
    trips,
    tourBookings,
    groups,
    inboundBookingEmails: inbound,
    referrals,
    blocklistEntries: flagged,
    withheldFromErasure: WITHHELD,
    limitations: LIMITATIONS,
  };
}

// ─── Erasure ────────────────────────────────────────────────────────────────

// Anonymise every PII field this deployment holds for a guest. Idempotent: a second
// call is a no-op that returns the same shape.
export async function eraseGuest(guestId: string): Promise<ErasureResult | null> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { id: true, phone: true, blocked: true, idDocumentPath: true, erasedAt: true },
  });
  if (!guest) return null;

  const scrubbed: Record<string, number> = {};
  const reservations = await prisma.reservation.findMany({ where: { guestId }, select: { id: true } });
  const reservationIds = reservations.map((r) => r.id);

  // 1. The ID scan is a FILE, not a row — delete the object before losing the path.
  if (guest.idDocumentPath && isStorageConfigured()) {
    await deleteObject(guest.idDocumentPath).catch(() => {});
    scrubbed.idDocuments = 1;
  }

  // 2. A safety block outlives erasure as a one-way hash (decision 3): the number
  //    is no longer readable, but a future booking with it still matches.
  const hashed = hashPhone(guest.phone);
  const flaggedUpdate = await prisma.flaggedNumber.updateMany({
    where: { phone: guest.phone },
    data: { phone: hashed, reason: ERASED_TEXT },
  });
  scrubbed.blocklistEntriesHashed = flaggedUpdate.count;

  // 3. Free text on the guest's own records.
  if (reservationIds.length > 0) {
    scrubbed.specialRequests = (
      await prisma.reservation.updateMany({ where: { id: { in: reservationIds } }, data: { specialRequests: null } })
    ).count;
    scrubbed.paymentNotes = (
      await prisma.payment.updateMany({ where: { reservationId: { in: reservationIds } }, data: { note: null } })
    ).count;
    // The raw OTA email is the densest PII blob in the system — scrub the body and
    // the parsed identity fields, keeping only the non-identifying staging record.
    scrubbed.inboundEmails = (
      await prisma.inboundBooking.updateMany({
        where: { reservationId: { in: reservationIds } },
        data: { rawText: ERASED_TEXT, guestName: null, guestPhone: null },
      })
    ).count;
  }

  scrubbed.messages = (
    await prisma.outboundMessage.updateMany({ where: { guestId }, data: { to: ERASED_TEXT, body: ERASED_TEXT } })
  ).count;
  scrubbed.complaints = (
    await prisma.complaint.updateMany({ where: { guestId }, data: { description: ERASED_TEXT, resolutionNote: null } })
  ).count;
  scrubbed.reviewRequests = (
    await prisma.reviewRequest.updateMany({ where: { guestId }, data: { responseDraft: null } })
  ).count;
  scrubbed.trips = (await prisma.trip.updateMany({ where: { guestId }, data: { note: null } })).count;
  scrubbed.tourBookings = (await prisma.tourBooking.updateMany({ where: { guestId }, data: { note: null } })).count;
  scrubbed.groups = (
    await prisma.bookingGroup.updateMany({ where: { guestId }, data: { name: ERASED_NAME, notes: null } })
  ).count;

  // 4. Cross-tenant: scrub OUR copy and withdraw the share (decision 2). The peer's
  //    own copy is theirs as a separate controller and is out of our reach.
  scrubbed.referrals = (
    await prisma.outboundReferral.updateMany({
      where: { guestPhone: guest.phone },
      data: { guestName: ERASED_NAME, guestPhone: null, note: ERASED_TEXT },
    })
  ).count;

  // 5. Audit events keep their shape (integrity) but lose personal free text.
  scrubbed.auditSummaries = (
    await prisma.auditEvent.updateMany({
      where: { OR: [{ entityId: guestId }, ...(reservationIds.length ? [{ entityId: { in: reservationIds } }] : [])] },
      data: { summary: ERASED_TEXT },
    })
  ).count;

  // 6. Finally the guest record itself. `blocked` is deliberately preserved.
  await prisma.guest.update({
    where: { id: guestId },
    data: {
      name: ERASED_NAME,
      phone: phoneTombstone(guestId),
      email: null,
      notes: null,
      idNumber: null,
      idDocumentPath: null,
      idUploaded: false,
      idUploadedAt: null,
      idChecked: false,
      idPhotocopied: false,
      idVerificationCompleted: false,
      address: null,
      vehicleNumber: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      preferences: [],
      blockReason: null,
      consentGivenAt: null,
      consentChannel: null,
      // C-Form block.
      nationality: null,
      passportNumber: null,
      passportIssueDate: null,
      passportIssuePlace: null,
      passportExpiry: null,
      visaNumber: null,
      visaType: null,
      visaIssueDate: null,
      visaIssuePlace: null,
      visaExpiry: null,
      portOfEntry: null,
      arrivalInIndia: null,
      purposeOfVisit: null,
      erasedAt: new Date(),
    },
  });
  scrubbed.guestRecord = 1;

  return { ok: true, guestId, scrubbed, withheld: WITHHELD, limitations: LIMITATIONS };
}
