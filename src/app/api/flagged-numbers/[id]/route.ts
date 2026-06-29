import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";

// DELETE /api/flagged-numbers/[id] — remove a number from the scam list

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.flaggedNumber.findUnique({ where: { id } });
  if (!existing) return fail("not found", 404);
  await prisma.flaggedNumber.delete({ where: { id } });
  return ok({ id });
}
