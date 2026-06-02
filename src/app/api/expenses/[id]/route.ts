import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return fail("expense not found", 404);

  await prisma.expense.delete({ where: { id } });
  return ok({ deleted: true });
}
