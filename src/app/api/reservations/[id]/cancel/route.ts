import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";

// Cancelling sets status to 'cancelled', which drops the row out of the
// exclusion-constraint predicate and frees the dates for re-booking.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) return fail("reservation not found", 404);

  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status: "cancelled" },
    include: { guest: true, channel: true, room: { include: { roomType: true } } },
  });
  return ok(reservation);
}
