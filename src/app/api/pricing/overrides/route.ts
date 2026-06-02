import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";

// Pin or clear a manual nightly rate for a room type on one date (rate calendar).
const upsertSchema = z.object({
  roomTypeId: z.string().min(1),
  date: dateOnly,
  rate: z.number().positive(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { roomTypeId, date, rate } = parsed.data;

  const override = await prisma.rateOverride.upsert({
    where: { roomTypeId_date: { roomTypeId, date: parseDateOnly(date) } },
    create: { roomTypeId, date: parseDateOnly(date), rate },
    update: { rate },
  });
  return ok(override, 201);
}

const deleteSchema = z.object({ roomTypeId: z.string().min(1), date: dateOnly });

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { roomTypeId, date } = parsed.data;

  await prisma.rateOverride.deleteMany({ where: { roomTypeId, date: parseDateOnly(date) } });
  return ok({ deleted: true });
}
