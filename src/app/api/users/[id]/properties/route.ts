import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listUserProperties } from "@/lib/properties";
import { recordAudit } from "@/lib/audit";

// Set which properties a login may act in — the "assign & reshuffle staff across
// properties" control. Owner (or platform admin) only.
//
// Access is modelled as the FULL set of properties the user may access, stored as
// UserProperty rows. The user's User.propertyId (their default acting property) is
// kept pointing at one of that set, so their session always binds somewhere valid —
// this is what lets a reshuffle actually MOVE a user, not just add a property.

const schema = z.object({
  propertyIds: z.array(z.string().min(1)).min(1, "A user must be able to access at least one property."),
});

async function handlePUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return fail("Not signed in.", 401);
  if (session.role !== "owner" && !session.isPlatformAdmin) {
    return fail("Only the owner can change property access.", 403);
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const requested = [...new Set(parsed.data.propertyIds)];

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, propertyId: true } });
  if (!target) return fail("No such user.", 404);

  // You can only grant properties you yourself run — never one you don't.
  const ownAccessible = new Set((await listUserProperties(session.sub, session.propertyId)).map((p) => p.id));
  const notYours = requested.filter((pid) => !ownAccessible.has(pid));
  if (notYours.length > 0) return fail("You can't grant access to a property you don't run.", 403);

  // Replace the user's grant set with exactly the requested one. UserProperty has
  // no compound unique, so a wholesale replace is cleaner than per-row upserts.
  await prisma.$transaction([
    prisma.userProperty.deleteMany({ where: { userId: id } }),
    prisma.userProperty.createMany({ data: requested.map((propertyId) => ({ userId: id, propertyId })) }),
  ]);

  // Keep the user's default acting property inside the set they can reach.
  if (!target.propertyId || !requested.includes(target.propertyId)) {
    await prisma.user.update({ where: { id }, data: { propertyId: requested[0] } });
  }

  await recordAudit("user.property-access", "user", id, `Set property access (${requested.length})`).catch(() => {});
  return ok({ userId: id, propertyIds: requested });
}

export const PUT = withRoute(handlePUT);
