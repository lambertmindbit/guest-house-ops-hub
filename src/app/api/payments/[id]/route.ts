import { prisma } from "@/lib/prisma";
import { ok, fail, withRoute } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) return fail("payment not found", 404);
  await prisma.payment.delete({ where: { id } });
  await recordAudit("payment.delete", "payment", id, `Removed ₹${Math.round(Number(existing.amount)).toLocaleString("en-IN")} (${existing.mode})`).catch(() => {});
  return ok({ deleted: true });
}

export const DELETE = withRoute(handleDELETE);
