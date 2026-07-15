import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { prisma, prismaForTenant, unscopedPrisma } from "@/lib/prisma";
import { listUserProperties } from "@/lib/properties";
import { recordAudit } from "@/lib/audit";

// Create and list the properties an owner runs. This is the surface the app never
// had — until now the only way to get a second property was a database script.
//
// Creating a property is an OWNER (or platform-admin) action. Reception and
// housekeeping cannot mint properties.

// A new property is born with the channels a small guest house actually books
// through — no OTAs (none of these owners list on them). Channels are a required
// FK on every reservation, so a property with none could not take a single
// booking; seeding them is what makes the new property usable immediately.
const DEFAULT_CHANNELS: { name: string; commissionPct: number; collectsPayment: boolean }[] = [
  { name: "Direct", commissionPct: 0, collectsPayment: false },
  { name: "Phone", commissionPct: 0, collectsPayment: false },
  { name: "WhatsApp", commissionPct: 0, collectsPayment: false },
  { name: "Website", commissionPct: 0, collectsPayment: false },
  { name: "Travel agent", commissionPct: 10, collectsPayment: false },
];

async function handleGET() {
  const session = await getSession();
  if (!session) return fail("Not signed in.", 401);
  return ok(await listUserProperties(session.sub, session.propertyId));
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the property a name.").max(120),
});

async function handlePOST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Not signed in.", 401);
  if (session.role !== "owner" && !session.isPlatformAdmin) {
    return fail("Only the owner can add a property.", 403);
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);

  // PropertySettings is the tenant ROOT — not auto-scoped — so create it on the
  // unscoped client. If we used the request-scoped `prisma`, the extension would
  // try to stamp it with the CURRENT property's id, which is nonsense for a row
  // that IS a property.
  const property = await unscopedPrisma.propertySettings.create({
    data: { name: parsed.data.name },
  });

  // Channels ARE tenant-scoped, so bind them to the NEW property explicitly —
  // never the request's current one.
  await prismaForTenant(property.id).channel.createMany({ data: DEFAULT_CHANNELS });

  // Grant the creator access, so it appears in their switcher immediately.
  await prisma.userProperty.create({
    data: { userId: session.sub, propertyId: property.id },
  });

  await recordAudit("property.create", "property", property.id, `Created property "${property.name}"`).catch(() => {});

  return ok({ id: property.id, name: property.name }, 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
