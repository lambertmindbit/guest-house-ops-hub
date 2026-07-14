import { z } from "zod";
import { ok, fail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { unscopedPrisma } from "@/lib/prisma";
import { isToggleable } from "@/lib/modules";

// Vendor-only: set which modules a property gets.
//
// Two guards, both necessary:
//
//  1. Platform admin only. Read from the DB (getSession re-reads the user), never
//     from a cookie claim — revoking the flag must bite on the next request.
//  2. Every id must be a KNOWN, TOGGLEABLE module. Unknown ids are rejected rather
//     than stored, so nobody can persist "calendar" into disabled_modules and hope
//     something downstream honours it. (Nothing would — isToggleable() filters on
//     read too — but storing a lie is how the next bug starts.)

const Body = z.object({
  propertyId: z.string().min(1),
  disabledModules: z.array(z.string()).max(50),
});

async function handlePATCH(request: Request) {
  const session = await getSession();
  if (!session) return fail("Not signed in.", 401);
  if (!session.isPlatformAdmin) return fail("Not found.", 404); // don't advertise the console

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Bad request.", 400);
  const { propertyId, disabledModules } = parsed.data;

  const unknown = disabledModules.filter((m) => !isToggleable(m));
  if (unknown.length > 0) {
    return fail(`Not a module that can be switched off: ${unknown.join(", ")}`, 400);
  }

  // unscopedPrisma is deliberate: the admin acts across the properties of THIS
  // deployment, before any tenant is bound. Safe because each client has their own
  // database — "every property here" is one client's properties, never another's.
  const property = await unscopedPrisma.propertySettings.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) return fail("No such property.", 404);

  await unscopedPrisma.propertySettings.update({
    where: { id: propertyId },
    data: { disabledModules: [...new Set(disabledModules)] },
  });

  return ok({ propertyId, disabledModules });
}

export const PATCH = withRoute(handlePATCH);
