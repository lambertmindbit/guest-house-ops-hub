import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";

// PropertySettings is a single-row table. Read returns the row (creating it with
// defaults on first access); PATCH upserts the owner's edits onto that one row.
async function getOrCreate() {
  const existing = await prisma.propertySettings.findFirst();
  return existing ?? prisma.propertySettings.create({ data: {} });
}

export async function GET() {
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
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "no fields to update",
  });

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const current = await getOrCreate();
  const settings = await prisma.propertySettings.update({
    where: { id: current.id },
    data: parsed.data,
  });
  return ok(settings);
}
