import { prisma, unscopedPrisma } from "@/lib/prisma";
import { isStorageConfigured, deleteObject } from "@/lib/storage";

// ID-document retention (Gap 12). A property may set idRetentionDays; documents
// older than that are purged (object deleted + flags cleared). Pure selection
// logic is separated so it's unit-testable without a DB.

export type GuestIdRow = { id: string; idDocumentPath: string | null; idUploadedAt: Date | null };

// A single document is expired if a positive retention window has elapsed since
// upload. Null retention (or ≤ 0) = keep indefinitely; null uploadedAt = unknown
// age, keep (never purge what we can't date).
export function isIdExpired(idUploadedAt: Date | null, retentionDays: number | null, now: Date): boolean {
  if (!retentionDays || retentionDays <= 0 || !idUploadedAt) return false;
  const ageMs = now.getTime() - idUploadedAt.getTime();
  return ageMs > retentionDays * 24 * 60 * 60 * 1000;
}

// Pure: which guests' ID documents should be purged now.
export function expiredIdDocuments(guests: GuestIdRow[], retentionDays: number | null, now: Date): GuestIdRow[] {
  return guests.filter((g) => g.idDocumentPath && isIdExpired(g.idUploadedAt, retentionDays, now));
}

// The owner's ONE retention window, given each property's setting.
//
// Guests are shared across an owner's properties (a single record, one ID document
// owner-wide — see the Guest model), so a document cannot be "owned" by one
// property's policy. We take the STRICTEST — the shortest positive window — so a
// scanned ID is never kept longer than ANY of the owner's properties permits, which
// is the compliance-safe direction. Properties with no window (null / ≤ 0) don't
// impose one and are ignored; if none set a window, the answer is null (keep
// indefinitely). With a single property this is exactly that property's window —
// identical to the old findFirst() — so single-property behaviour is unchanged.
export function strictestRetentionDays(windows: (number | null)[]): number | null {
  const positive = windows.filter((d): d is number => typeof d === "number" && d > 0);
  return positive.length > 0 ? Math.min(...positive) : null;
}

// Delete the storage object (best-effort) and clear the ID flags for every guest
// whose document has aged past the property's retention window. No-op when no
// policy is set. Returns the number of documents purged.
export async function purgeExpiredIdDocuments(now = new Date()): Promise<{ purged: number }> {
  // Runs from the daily cron with no acting property. Guests are owner-wide (shared),
  // so we purge against the owner's ONE window — the strictest across their
  // properties (strictestRetentionDays). unscopedPrisma to read EVERY property's
  // setting; with a single property this is that property's window, unchanged.
  const properties = await unscopedPrisma.propertySettings.findMany({ select: { idRetentionDays: true } });
  const retentionDays = strictestRetentionDays(properties.map((p) => p.idRetentionDays));
  if (!retentionDays) return { purged: 0 };

  const guests = await prisma.guest.findMany({
    where: { idDocumentPath: { not: null }, idUploadedAt: { not: null } },
    select: { id: true, idDocumentPath: true, idUploadedAt: true },
  });
  const expired = expiredIdDocuments(guests, retentionDays, now);

  for (const g of expired) {
    if (isStorageConfigured() && g.idDocumentPath) await deleteObject(g.idDocumentPath).catch(() => {});
    await prisma.guest.update({ where: { id: g.id }, data: { idDocumentPath: null, idUploaded: false, idUploadedAt: null } });
  }
  return { purged: expired.length };
}
