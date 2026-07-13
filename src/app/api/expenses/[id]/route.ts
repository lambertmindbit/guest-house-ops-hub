import { prisma } from "@/lib/prisma";
import { ok, fail, withRoute } from "@/lib/api";

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return fail("expense not found", 404);

  await prisma.expense.delete({ where: { id } });
  return ok({ deleted: true });
}

export const DELETE = withRoute(handleDELETE);
