import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { reportScam, listMyScamReports, sharedScamListFor, lookupScam } from "@/lib/community/scam";
import { recordAudit } from "@/lib/audit";

// Owner-only (see OWNER_ONLY_PREFIXES). Lists my reports + peers' shared reports;
// ?lookup=phone matches by hash. CSV export lives at ./export.csv.

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);
  const url = new URL(request.url);

  const lookup = url.searchParams.get("lookup");
  if (lookup) return ok(await lookupScam(session.propertyId, lookup));

  const [mine, shared] = await Promise.all([
    listMyScamReports(session.propertyId),
    sharedScamListFor(session.propertyId),
  ]);
  return ok({ mine, shared });
}

const schema = z.object({
  phone: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  evidenceNote: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);

  const result = await reportScam(session.propertyId, { ...parsed.data, createdByUserId: session.sub });
  if (!result.ok) return fail(result.error, 400);

  await recordAudit("community.scam.report", "shared_scam_report", result.id, "Filed a scam report").catch(() => {});
  return ok({ id: result.id }, 201);
}
