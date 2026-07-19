import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { recordAudit } from "@/lib/audit";

// Owner-only (see OWNER_ONLY_PREFIXES in authz): recording OTA settlements is a
// money operation. Reconciliation itself is derived in getPayoutReconciliation.

async function handleGET() {
  const payouts = await prisma.payout.findMany({ orderBy: { paidAt: "desc" } });
  return ok(payouts);
}

const createSchema = z.object({
  channelId: z.string().min(1),
  amount: z.number().positive(),
  paidAt: dateOnly,
  reference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { channelId, amount, paidAt, reference, note } = parsed.data;

  // A payout only makes sense against an OTA-collect channel.
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { collectsPayment: true } });
  if (!channel) return fail("That channel no longer exists.", 404);
  if (!channel.collectsPayment) return fail("Payouts apply only to channels the OTA collects payment on.", 400);

  const payout = await prisma.payout.create({
    data: { channelId, amount, paidAt: parseDateOnly(paidAt), reference: reference || null, note: note || null },
  });
  await recordAudit("payout.record", "payout", payout.id, `₹${amount} on ${paidAt}`).catch(() => {});
  return ok(payout, 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
