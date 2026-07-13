import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { reportGuestAlert, listMyGuestAlerts, sharedGuestAlertsFor, lookupGuestAlert, ALERT_CATEGORIES } from "@/lib/community/badguest";
import { recordAudit } from "@/lib/audit";

// Owner-only. Lists my alerts + peers' shared alerts; ?lookup=phone matches by
// hash. CSV export lives at ./export.csv.

async function handleGET(request: Request) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);
  const url = new URL(request.url);

  const lookup = url.searchParams.get("lookup");
  if (lookup) return ok(await lookupGuestAlert(session.propertyId, lookup));

  const [mine, shared] = await Promise.all([
    listMyGuestAlerts(session.propertyId),
    sharedGuestAlertsFor(session.propertyId),
  ]);
  return ok({ mine, shared });
}

const schema = z.object({
  phone: z.string().trim().min(1),
  guestName: z.string().optional(),
  category: z.enum(ALERT_CATEGORIES as [string, ...string[]]),
  reason: z.string().trim().min(1),
  evidenceNote: z.string().optional(),
});

async function handlePOST(request: Request) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);

  const result = await reportGuestAlert(session.propertyId, {
    ...parsed.data,
    category: parsed.data.category as (typeof ALERT_CATEGORIES)[number],
    createdByUserId: session.sub,
  });
  if (!result.ok) return fail(result.error, 400);

  await recordAudit("community.badguest.report", "shared_guest_alert", result.id, "Filed a bad-guest alert").catch(() => {});
  return ok({ id: result.id }, 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
