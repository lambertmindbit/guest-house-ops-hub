import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail, withRoute } from "@/lib/api";
import { getCancellationPolicy } from "@/lib/cancellation";

const tierSchema = z.object({
  minDaysBefore: z.number().int().min(0).max(365),
  refundPct: z.number().min(0).max(100),
});

const schema = z
  .object({
    enabled: z.boolean().optional(),
    // The whole ladder is replaced on each save (it's one small config). Sorted
    // and de-duplicated by threshold before storing so reads are deterministic.
    tiers: z.array(tierSchema).max(10).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handleGET() {
  return ok(await getCancellationPolicy());
}

// Single-row policy: update the existing row or create the first one.
async function handlePATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const tiers =
    parsed.data.tiers === undefined
      ? undefined
      : [...new Map(parsed.data.tiers.map((t) => [t.minDaysBefore, t])).values()].sort(
          (a, b) => b.minDaysBefore - a.minDaysBefore,
        );
  const data = {
    ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
    ...(tiers !== undefined ? { tiers } : {}),
  };

  const existing = await prisma.cancellationPolicy.findFirst();
  if (existing) await prisma.cancellationPolicy.update({ where: { id: existing.id }, data });
  else await prisma.cancellationPolicy.create({ data });

  return ok(await getCancellationPolicy());
}

export const GET = withRoute(handleGET);
export const PATCH = withRoute(handlePATCH);
