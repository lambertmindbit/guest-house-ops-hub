import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";

const schema = z.object({
  amount: z.number().positive(),
  mode: z.enum(["cash", "upi", "card", "bank", "ota_collect"]),
  isAdvance: z.boolean().optional(),
  paidAt: dateOnly.optional(),
  note: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return fail("reservation not found", 404);

  const payment = await prisma.payment.create({
    data: {
      reservationId: id,
      amount: parsed.data.amount,
      mode: parsed.data.mode,
      isAdvance: parsed.data.isAdvance ?? false,
      note: parsed.data.note,
      ...(parsed.data.paidAt ? { paidAt: parseDateOnly(parsed.data.paidAt) } : {}),
    },
  });
  return ok(payment, 201);
}
