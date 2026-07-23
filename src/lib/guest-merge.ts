import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/community/scam";

// Guest merge / duplicate resolution (GAP-19). Two records for the same person —
// usually the same phone typed two ways ("9998887777" vs "+91 99988 87777") — split
// their history across two rows. Merging folds the duplicate into a survivor: every
// booking/message/complaint is reassigned, PII is combined, and the duplicate row is
// deleted. Guest.phone is UNIQUE, so exact-duplicate phones can't exist; near-
// duplicates only differ in formatting, which is exactly what normalizePhone catches.

// Tables that carry a guestId — ALL must move to the survivor or the merge orphans
// history. Kept as a list so a newly-added guest relation is a one-line change.
const GUEST_FK_MODELS = [
  "reservation", "outboundMessage", "complaint", "reviewRequest", "trip", "tourBooking", "bookingGroup",
] as const;

export type DuplicateGroup = { normalizedPhone: string; guestIds: string[] };

// Pure: guests whose phone normalizes to the same number are candidate duplicates.
// Only groups of 2+ are returned. Blank/short numbers are ignored (too weak a match).
export function duplicateGroups(guests: { id: string; phone: string }[]): DuplicateGroup[] {
  const byNorm = new Map<string, string[]>();
  for (const g of guests) {
    const n = normalizePhone(g.phone);
    if (n.length < 7) continue; // not a confident match key
    (byNorm.get(n) ?? byNorm.set(n, []).get(n)!).push(g.id);
  }
  return [...byNorm.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([normalizedPhone, guestIds]) => ({ normalizedPhone, guestIds }));
}

export type MergeResult =
  | { ok: true; survivorId: string; reassigned: Record<string, number> }
  | { ok: false; error: string };

// Fold `duplicateId` into `survivorId`: reassign all history, fill any PII the
// survivor is missing from the duplicate, then delete the duplicate. Atomic.
export async function mergeGuests(survivorId: string, duplicateId: string): Promise<MergeResult> {
  if (survivorId === duplicateId) return { ok: false, error: "Pick two different guests to merge." };

  const [survivor, duplicate] = await Promise.all([
    prisma.guest.findUnique({ where: { id: survivorId } }),
    prisma.guest.findUnique({ where: { id: duplicateId } }),
  ]);
  if (!survivor || !duplicate) return { ok: false, error: "One of the guests no longer exists." };
  if (survivor.erasedAt || duplicate.erasedAt) return { ok: false, error: "An erased guest can't be merged." };

  // Fill only fields the survivor is MISSING — never overwrite the survivor's own
  // data. Name and phone are the survivor's identity and are kept as-is.
  const fill: Record<string, unknown> = {};
  const OPTIONAL: (keyof typeof duplicate)[] = [
    "email", "notes", "idNumber", "idDocumentPath", "address", "vehicleNumber",
    "emergencyContactName", "emergencyContactPhone", "blockReason", "consentGivenAt", "consentChannel",
    "nationality", "passportNumber", "visaNumber",
  ];
  for (const k of OPTIONAL) {
    if ((survivor[k] === null || survivor[k] === undefined) && duplicate[k] != null) fill[k as string] = duplicate[k];
  }
  // Union preferences; a block on either survives (safety signal must not be lost).
  const preferences = [...new Set([...(survivor.preferences ?? []), ...(duplicate.preferences ?? [])])];
  const blocked = survivor.blocked || duplicate.blocked;

  const reassigned: Record<string, number> = {};
  await prisma.$transaction(async (tx) => {
    for (const model of GUEST_FK_MODELS) {
      // @ts-expect-error dynamic model access over a known-safe list
      const r = await tx[model].updateMany({ where: { guestId: duplicateId }, data: { guestId: survivorId } });
      reassigned[model] = r.count;
    }
    await tx.guest.update({
      where: { id: survivorId },
      data: { ...fill, preferences, blocked, blockReason: blocked ? (survivor.blockReason ?? duplicate.blockReason) : null },
    });
    await tx.guest.delete({ where: { id: duplicateId } });
  });

  return { ok: true, survivorId, reassigned };
}
