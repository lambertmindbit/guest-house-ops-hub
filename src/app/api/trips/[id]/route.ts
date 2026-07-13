import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";

const schema = z
  .object({
    driverId: z.string().min(1).nullable().optional(),
    guestId: z.string().min(1).nullable().optional(),
    pickup: z.string().trim().min(1).optional(),
    dropoff: z.string().trim().min(1).optional(),
    scheduledAt: dateOnly.nullable().optional(),
    fare: z.number().nonnegative().nullable().optional(),
    status: z.enum(["planned", "done", "cancelled"]).optional(),
    note: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const existing = await prisma.trip.findUnique({ where: { id } });
  if (!existing) return fail("trip not found", 404);
  const { scheduledAt, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? parseDateOnly(scheduledAt) : null;
  return ok(await prisma.trip.update({ where: { id }, data }));
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.trip.findUnique({ where: { id } });
  if (!existing) return fail("trip not found", 404);
  await prisma.trip.delete({ where: { id } });
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
