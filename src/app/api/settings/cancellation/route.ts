import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";
import { getCancellationPolicy } from "@/lib/cancellation";

const schema = z
  .object({
    enabled: z.boolean().optional(),
    freeCancelDaysDefault: z.number().int().min(0).max(365).optional(),
    freeCancelDaysPeak: z.number().int().min(0).max(365).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

export async function GET() {
  return ok(await getCancellationPolicy());
}

// Single-row policy: update the existing row or create the first one.
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.cancellationPolicy.findFirst();
  const row = existing
    ? await prisma.cancellationPolicy.update({ where: { id: existing.id }, data: parsed.data })
    : await prisma.cancellationPolicy.create({ data: parsed.data });

  return ok({
    enabled: row.enabled,
    freeCancelDaysDefault: row.freeCancelDaysDefault,
    freeCancelDaysPeak: row.freeCancelDaysPeak,
  });
}
