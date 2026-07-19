import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { formatPaise, type Money } from "@/lib/money";

// Record a refund against a booking. Owner-committed (this route is cookie-gated);
// agents never refund. Created as `requested`; the owner then approves / marks
// partial / rejects via PATCH /api/refunds/[id].
const schema = z.object({
  amount: z.number().int().nonnegative(), // paise (GAP-9)
  reason: z.string().trim().min(1).nullable().optional(),
});

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return fail("reservation not found", 404);

  // You can't refund more than was collected (net of refunds already on file).
  const [payments, refunds] = await Promise.all([
    prisma.payment.findMany({ where: { reservationId: id }, select: { amount: true } }),
    prisma.refund.findMany({ where: { reservationId: id, status: { not: "rejected" } }, select: { amount: true } }),
  ]);
  const collected = payments.reduce((s, p) => s + Number(p.amount), 0); // paise
  const alreadyRefunded = refunds.reduce((s, r) => s + Number(r.amount), 0); // paise
  const refundable = (collected - alreadyRefunded) as Money;
  if (parsed.data.amount > refundable) {
    return fail(`Refund exceeds what's collected. At most ${formatPaise(refundable)} can be refunded.`, 422);
  }

  const refund = await prisma.refund.create({
    data: { reservationId: id, amount: parsed.data.amount, reason: parsed.data.reason ?? null },
  });
  return ok(refund, 201);
}

export const POST = withRoute(handlePOST);
