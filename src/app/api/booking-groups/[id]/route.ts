import { prisma } from "@/lib/prisma";
import { ok, fail, withRoute } from "@/lib/api";

// Delete the group wrapper. Children keep their bookings — the FK is ON DELETE
// SET NULL, so they're just detached (never removed).
async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.bookingGroup.findUnique({ where: { id } });
  if (!existing) return fail("group not found", 404);
  await prisma.bookingGroup.delete({ where: { id } });
  return ok({ deleted: true });
}

export const DELETE = withRoute(handleDELETE);
