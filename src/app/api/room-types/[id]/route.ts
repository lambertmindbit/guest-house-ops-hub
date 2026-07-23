import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    baseRate: z.number().nonnegative().optional(),
    maxOccupancy: z.number().int().positive().optional(),
    rateFloor: z.number().nonnegative().optional(),
    rateCeiling: z.number().nonnegative().optional(),
    oversellBuffer: z.number().int().min(0).optional(), // GAP-24
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "no fields to update",
  });

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.roomType.findUnique({ where: { id } });
  if (!existing) return fail("room type not found", 404);

  // Guard the combined floor/ceiling using current values for any omitted field.
  const floor = parsed.data.rateFloor ?? Number(existing.rateFloor);
  const ceiling = parsed.data.rateCeiling ?? Number(existing.rateCeiling);
  if (floor > ceiling) return fail("rateFloor: floor must be ≤ ceiling", 422);

  const type = await prisma.roomType.update({ where: { id }, data: parsed.data });
  return ok(type);
}

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.roomType.findUnique({ where: { id } });
  if (!existing) return fail("room type not found", 404);

  const rooms = await prisma.room.count({ where: { roomTypeId: id } });
  if (rooms > 0) return fail("Room type still has rooms — reassign or remove them first.", 409);

  await prisma.roomType.delete({ where: { id } });
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
