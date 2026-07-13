import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { verifyScamReport, disputeScamReport } from "@/lib/community/scam";
import { recordAudit } from "@/lib/audit";

const schema = z.object({ action: z.enum(["verify", "dispute"]) });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);

  const result = parsed.data.action === "verify"
    ? await verifyScamReport(id, session.propertyId)
    : await disputeScamReport(id, session.propertyId);
  if (!result.ok) return fail(result.error, 409);

  await recordAudit(`community.scam.${parsed.data.action}`, "shared_scam_report", id).catch(() => {});
  return ok({ ok: true });
}

export const PATCH = withRoute(handlePATCH);
