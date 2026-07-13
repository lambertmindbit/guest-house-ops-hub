import { prisma } from "@/lib/prisma";
import { ok, fail, withRoute } from "@/lib/api";

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) return fail("shift not found", 404);
  await prisma.shift.delete({ where: { id } });
  return ok({ deleted: true });
}

export const DELETE = withRoute(handleDELETE);
