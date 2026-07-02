import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { proposeReferral, listReferrals } from "@/lib/community/referrals";
import { recordAudit } from "@/lib/audit";

// Overflow referrals. Owner + reception (reception handles overflow). Acting
// property is always the session's — never the request body.

export async function GET() {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);
  return ok(await listReferrals(session.propertyId));
}

const schema = z.object({
  toPropertyId: z.string().min(1),
  guestName: z.string().min(1),
  guestPhone: z.string().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn must be YYYY-MM-DD"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut must be YYYY-MM-DD"),
  roomTypeNeed: z.string().optional(),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const { toPropertyId, ...input } = parsed.data;
  if (input.checkOut <= input.checkIn) return fail("Check-out must be after check-in.", 400);

  const result = await proposeReferral(session.propertyId, toPropertyId, input);
  if (!result.ok) return fail(result.error, 409);

  await recordAudit("community.referral.propose", "referral", result.referralId, `Referred ${input.guestName} to a peer`).catch(() => {});
  return ok({ id: result.referralId }, 201);
}
