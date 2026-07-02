import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { verifyGuestAlert, disputeGuestAlert } from "@/lib/community/badguest";
import { recordAudit } from "@/lib/audit";

const schema = z.object({ action: z.enum(["verify", "dispute"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);

  const result = parsed.data.action === "verify"
    ? await verifyGuestAlert(id, session.propertyId)
    : await disputeGuestAlert(id, session.propertyId);
  if (!result.ok) return fail(result.error, 409);

  await recordAudit(`community.badguest.${parsed.data.action}`, "shared_guest_alert", id).catch(() => {});
  return ok({ ok: true });
}
