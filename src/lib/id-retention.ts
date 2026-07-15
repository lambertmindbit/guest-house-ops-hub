import { prisma } from "@/lib/prisma";
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

// Delete the storage object (best-effort) and clear the ID flags for every guest
// whose document has aged past the property's retention window. No-op when no
// policy is set. Returns the number of documents purged.
export async function purgeExpiredIdDocuments(now = new Date()): Promise<{ purged: number }> {
  // KNOWN multi-property gap, left deliberately: this runs from the daily cron with
  // no acting property, and reads a SINGLE retention policy. With two properties it
  // would apply one property's window to everyone. The correct fix is to iterate
  // properties and purge each under its own policy — a separate change from this
  // read-resolver slice. findFirst is kept (not the resolver) precisely so this
  // stays obviously wrong-for-multi rather than silently doing nothing.
  const settings = await prisma.propertySettings.findFirst({ select: { idRetentionDays: true } });
  const retentionDays = settings?.idRetentionDays ?? null;
  if (!retentionDays || retentionDays <= 0) return { purged: 0 };

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
