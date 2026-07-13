import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { respondToReferral } from "@/lib/community/referrals";
import { recordAudit } from "@/lib/audit";

const schema = z.object({ action: z.enum(["accept", "decline"]) });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);

  const result = await respondToReferral(id, session.propertyId, parsed.data.action === "accept");
  if (!result.ok) return fail(result.error, 409);

  await recordAudit(`community.referral.${parsed.data.action}`, "referral", id).catch(() => {});
  return ok({ ok: true });
}

export const PATCH = withRoute(handlePATCH);
