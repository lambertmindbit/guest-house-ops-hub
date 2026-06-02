import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.season.findUnique({ where: { id } });
  if (!existing) return fail("season not found", 404);

  await prisma.season.delete({ where: { id } });
  return ok({ deleted: true });
}
