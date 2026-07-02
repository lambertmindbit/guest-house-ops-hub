import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { respondToInvite } from "@/lib/community/network";
import { recordAudit } from "@/lib/audit";

const schema = z.object({ action: z.enum(["accept", "decline", "revoke"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "owner") return fail("Owners only.", 403);
  const propertyId = session.propertyId;
  if (!propertyId) return fail("No property is bound to your account.", 400);

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);

  const result = await respondToInvite(id, propertyId, parsed.data.action);
  if (!result.ok) return fail(result.error, 409);

  await recordAudit(`community.${parsed.data.action}`, "network_connection", id).catch(() => {});
  return ok({ ok: true });
}
