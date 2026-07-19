import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, unscopedPrisma } from "@/lib/prisma";
import { ok, zodFail, withRoute } from "@/lib/api";
import { currentPropertySettings } from "@/lib/property-settings";
import { recordAudit } from "@/lib/audit";

// Settings for the ACTING property. Resolve it properly rather than findFirst() —
// with two properties, findFirst() would let the owner edit whichever comes first,
// not the one they're viewing. This route is owner-gated and always hit with a
// bound session, so the acting property always resolves; the create-on-empty path
// is only for a brand-new install.
async function getOrCreate() {
  const existing = await currentPropertySettings();
  return existing ?? unscopedPrisma.propertySettings.create({ data: {} });
}

async function handleGET() {
  return ok(await getOrCreate());
}

const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    checkInTime: z.string().regex(/^\d{2}:\d{2}$/, "use HH:MM").optional(),
    checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, "use HH:MM").optional(),
    currency: z.string().trim().min(1).optional(),
    timezone: z.string().trim().min(1).optional(),
    address: z.string().nullable().optional(),
    gstNumber: z.string().nullable().optional(),
    upiVpa: z.string().trim().nullable().optional(),
    idRetentionDays: z.number().int().min(0).max(3650).nullable().optional(),
    idPolicy: z.enum(["off", "warn", "block"]).optional(),
    idRequiredAtBooking: z.boolean().optional(),
    // Statutory invoicing (GAP-11): series prefix + editable GST slab table.
    invoicePrefix: z.string().trim().max(8).nullable().optional(),
    gstSlabs: z
      .array(z.object({ uptoPaise: z.number().int().positive().nullable(), ratePct: z.number().min(0).max(100) }))
      .nullable()
      .optional(),
    // Optional housekeeping inspection step (GAP-20).
    inspectionRequired: z.boolean().optional(),
    // iCal sync frequency in hours (GAP-6): 1 = hourly minimum, 24 = daily default.
    icalSyncHours: z.number().int().min(1).max(24).optional(),
    // Owner web-push toggles per event (GAP-14).
    pushEscalations: z.boolean().optional(),
    pushConflicts: z.boolean().optional(),
    pushStaleSync: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "no fields to update",
  });

async function handlePATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const current = await getOrCreate();
  // A nullable Json column clears with Prisma.DbNull, not a bare null — clearing
  // gstSlabs falls the property back to the statutory defaults in src/lib/gst.ts.
  const { gstSlabs, ...rest } = parsed.data;
  const settings = await prisma.propertySettings.update({
    where: { id: current.id },
    data: {
      ...rest,
      ...(gstSlabs === undefined ? {} : { gstSlabs: gstSlabs === null ? Prisma.DbNull : gstSlabs }),
    },
  });
  await recordAudit("settings.update", "property_settings", settings.id, `Updated property settings (${Object.keys(parsed.data).join(", ")})`).catch(() => {});
  return ok(settings);
}

export const GET = withRoute(handleGET);
export const PATCH = withRoute(handlePATCH);
