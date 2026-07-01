import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";

// Record a refund against a booking. Owner-committed (this route is cookie-gated);
// agents never refund. Created as `requested`; the owner then approves / marks
// partial / rejects via PATCH /api/refunds/[id].
const schema = z.object({
  amount: z.number().nonnegative(),
  reason: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return fail("reservation not found", 404);

  const refund = await prisma.refund.create({
    data: { reservationId: id, amount: parsed.data.amount, reason: parsed.data.reason ?? null },
  });
  return ok(refund, 201);
}
