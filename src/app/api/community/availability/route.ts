import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { peerAvailability } from "@/lib/community/availability";
import { recordAudit } from "@/lib/audit";

// Opt-in peer availability. Owner + reception (reception handles overflow). The
// grant check + audit happen through peerAvailability; a permission failure
// surfaces as a friendly 403.

const schema = z.object({
  peerPropertyId: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn must be YYYY-MM-DD"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut must be YYYY-MM-DD"),
});

async function handleGET(request: Request) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);

  const url = new URL(request.url);
  const parsed = schema.safeParse({
    peerPropertyId: url.searchParams.get("peerPropertyId"),
    checkIn: url.searchParams.get("checkIn"),
    checkOut: url.searchParams.get("checkOut"),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const { peerPropertyId, checkIn, checkOut } = parsed.data;
  if (checkOut <= checkIn) return fail("Check-out must be after check-in.", 400);

  try {
    const availability = await peerAvailability(peerPropertyId, session.propertyId, checkIn, checkOut);
    await recordAudit("community.availability.view", "property", peerPropertyId, `Viewed availability ${checkIn}→${checkOut}`).catch(() => {});
    return ok(availability);
  } catch {
    return fail("This property is not sharing availability with you.", 403);
  }
}

export const GET = withRoute(handleGET);
