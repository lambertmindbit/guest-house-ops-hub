import { prisma } from "@/lib/prisma";
import { ok, fail, withRoute } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { formatPaise } from "@/lib/money";

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) return fail("payment not found", 404);
  await prisma.payment.delete({ where: { id } });
  await recordAudit("payment.delete", "payment", id, `Removed ${formatPaise(existing.amount)} (${existing.mode})`).catch(() => {});
  return ok({ deleted: true });
}

export const DELETE = withRoute(handleDELETE);
