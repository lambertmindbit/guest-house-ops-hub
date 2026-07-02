import { fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { toCsv, csvResponse } from "@/lib/csv";
import { listMyGuestAlerts } from "@/lib/community/badguest";
import { recordAudit } from "@/lib/audit";

// CSV export of a property's own bad-guest alerts (owner-only via the
// /api/community/guest-alerts/ prefix).

export async function GET() {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);

  const mine = await listMyGuestAlerts(session.propertyId);
  await recordAudit("community.badguest.export", "shared_guest_alert", null, "Exported own bad-guest alerts").catch(() => {});
  const body = toCsv(
    ["Guest", "Last 4", "Category", "Reason", "Evidence", "Status", "Reported", "Expires"],
    mine.map((a) => [a.guestNameMasked ?? "", a.guestPhoneLast4 ?? "", a.category, a.reason, a.evidenceNote ?? "", a.status, a.createdAt, a.expiresAt ?? ""]),
  );
  return csvResponse("bad-guest-alerts.csv", body);
}
