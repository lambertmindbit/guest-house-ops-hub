import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { recordAudit } from "@/lib/audit";
import { formatPaise, type Money } from "@/lib/money";

const schema = z.object({
  amount: z.number().int().positive(), // paise (GAP-9)
  mode: z.enum(["cash", "upi", "card", "bank", "ota_collect"]),
  isAdvance: z.boolean().optional(),
  paidAt: dateOnly.optional(),
  note: z.string().optional(),
});

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return fail("reservation not found", 404);

  // Fat-finger guard: reject a payment that would push the TOTAL collected past
  // the booking total — catches both a single oversized amount (15000 for 1500)
  // and a second payment on an already-settled booking. Only enforced once a
  // gross is set. `collected` is derived, never stored.
  const gross = reservation.grossAmount ? Number(reservation.grossAmount) : 0; // paise
  if (gross > 0) {
    const priorPayments = await prisma.payment.aggregate({
      where: { reservationId: id },
      _sum: { amount: true },
    });
    const collected = Number(priorPayments._sum.amount ?? 0); // paise
    if (collected + parsed.data.amount > gross) {
      const remaining = Math.max(0, gross - collected) as Money;
      return fail(
        `That's more than the outstanding balance (${formatPaise(remaining)} of ${formatPaise(gross as Money)}). Check the amount.`,
        422,
      );
    }
  }

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
  await recordAudit("payment.create", "payment", payment.id, `Recorded ${formatPaise(payment.amount)} (${payment.mode})`).catch(() => {});
  return ok(payment, 201);
}

export const POST = withRoute(handlePOST);
