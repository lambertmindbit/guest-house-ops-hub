import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";

// Unblock a room. Only manual blocks are deletable here — iCal-imported blocks
// are owned by their feed sync and would just reappear on the next run.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.block.findUnique({ where: { id } });
  if (!existing) return fail("block not found", 404);
  if (existing.source !== "manual") {
    return fail("This block came from an iCal feed — manage it from Feeds.", 409);
  }

  await prisma.block.delete({ where: { id } });
  return ok({ deleted: true });
}
