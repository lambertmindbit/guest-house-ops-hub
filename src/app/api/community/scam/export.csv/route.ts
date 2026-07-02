import { fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { toCsv, csvResponse } from "@/lib/csv";
import { listMyScamReports } from "@/lib/community/scam";
import { recordAudit } from "@/lib/audit";

// CSV export of a property's own scam reports (owner-only via the
// /api/community/scam/ prefix). Path ends in .csv so the browser saves a file.

export async function GET() {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);

  const mine = await listMyScamReports(session.propertyId);
  await recordAudit("community.scam.export", "shared_scam_report", null, "Exported own scam reports").catch(() => {});
  const body = toCsv(
    ["Last 4", "Reason", "Evidence", "Status", "Reported", "Expires"],
    mine.map((r) => [r.phoneLast4 ?? "", r.reason, r.evidenceNote ?? "", r.status, r.createdAt, r.expiresAt ?? ""]),
  );
  return csvResponse("scam-reports.csv", body);
}
