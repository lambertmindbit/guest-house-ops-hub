import { ok } from "@/lib/api";
import { purgeExpiredIdDocuments } from "@/lib/id-retention";
import { recordAudit } from "@/lib/audit";

// Owner-triggered ID-document retention purge. Owner-only via the
// /api/id-documents prefix in authz.OWNER_ONLY_PREFIXES.
export async function POST() {
  const result = await purgeExpiredIdDocuments();
  if (result.purged > 0) {
    await recordAudit("id.retention.purge", "guest", null, `Purged ${result.purged} expired ID document(s)`).catch(() => {});
  }
  return ok(result);
}
