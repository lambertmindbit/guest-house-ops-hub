import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";

// The pricing policy is a single row. GET returns it (creating defaults on first
// access); PATCH upserts the owner's edits.
async function getOrCreate() {
  const existing = await prisma.pricingPolicy.findFirst();
  return existing ?? prisma.pricingPolicy.create({ data: {} });
}

export async function GET() {
  return ok(await getOrCreate());
}

const pct = z.number().min(-100).max(500);
const updateSchema = z
  .object({
    enabled: z.boolean().optional(),
    weekendDays: z.array(z.number().int().min(0).max(6)).optional(),
    weekendAdjustPct: pct.optional(),
    leadEarlyDays: z.number().int().min(0).nullable().optional(),
    leadEarlyAdjustPct: pct.nullable().optional(),
    leadLateDays: z.number().int().min(0).nullable().optional(),
    leadLateAdjustPct: pct.nullable().optional(),
    occupancyThresholdPct: z.number().int().min(0).max(100).nullable().optional(),
    occupancyAdjustPct: pct.nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const current = await getOrCreate();
  const policy = await prisma.pricingPolicy.update({ where: { id: current.id }, data: parsed.data });
  return ok(policy);
}
