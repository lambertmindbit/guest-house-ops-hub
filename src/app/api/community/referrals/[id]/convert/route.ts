import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { convertReferral } from "@/lib/community/referrals";
import { recordAudit } from "@/lib/audit";

// Link a booking (created the normal guarded way) to an accepted referral. This
// route does NOT create a reservation — it only attributes an existing one.

const schema = z.object({ reservationId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);

  const result = await convertReferral(id, session.propertyId, parsed.data.reservationId);
  if (!result.ok) return fail(result.error, 409);

  await recordAudit("community.referral.convert", "referral", id, "Linked a booking to a referral").catch(() => {});
  return ok({ ok: true });
}
