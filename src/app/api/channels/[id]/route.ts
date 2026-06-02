import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    commissionPct: z.number().min(0).max(100).optional(),
    collectsPayment: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "no fields to update",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.channel.findUnique({ where: { id } });
  if (!existing) return fail("channel not found", 404);

  const channel = await prisma.channel.update({ where: { id }, data: parsed.data });
  return ok(channel);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.channel.findUnique({ where: { id } });
  if (!existing) return fail("channel not found", 404);

  const reservations = await prisma.reservation.count({ where: { channelId: id } });
  if (reservations > 0) return fail("Channel has bookings — it can't be deleted.", 409);

  await prisma.channel.delete({ where: { id } });
  return ok({ deleted: true });
}
