import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail, withRoute } from "@/lib/api";

async function handleGET() {
  const types = await prisma.roomType.findMany({
    include: { _count: { select: { rooms: true } } },
    orderBy: { name: "asc" },
  });
  return ok(types);
}

// Rates are the floor/ceiling/base used by the pricing engine (Phase 2).
const createSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    baseRate: z.number().nonnegative(),
    maxOccupancy: z.number().int().positive(),
    rateFloor: z.number().nonnegative(),
    rateCeiling: z.number().nonnegative(),
  })
  .refine((d) => d.rateFloor <= d.rateCeiling, {
    path: ["rateFloor"],
    message: "floor must be ≤ ceiling",
  });

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const type = await prisma.roomType.create({ data: parsed.data });
  return ok(type, 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
