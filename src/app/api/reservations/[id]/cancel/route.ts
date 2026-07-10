import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { todayDateOnly, formatDateOnly } from "@/lib/dates";

// Cancelling sets status to 'cancelled', which drops the row out of the
// exclusion-constraint predicate and frees the dates for re-booking.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) return fail("reservation not found", 404);

  // Cancel is for a booking that hasn't happened yet — it frees future dates.
  // Refuse to cancel a stay that's already in progress or over: Finance and
  // Analytics count only 'confirmed' rows, so cancelling a completed booking
  // would silently erase it (and its payments) from revenue. Those need a
  // different remedy (edit / refund), not a cancel.
  if (existing.checkedOutAt) {
    return fail("This guest has already checked out — a completed stay can't be cancelled.", 409);
  }
  if (existing.checkedInAt) {
    return fail("This guest is checked in — check them out instead of cancelling.", 409);
  }
  if (formatDateOnly(existing.checkOut) <= todayDateOnly()) {
    return fail("This booking's stay has already passed — it can't be cancelled.", 409);
  }

  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status: "cancelled" },
    include: { guest: true, channel: true, room: { include: { roomType: true } } },
  });
  await recordAudit("reservation.cancel", "reservation", id, `Cancelled booking — ${reservation.guest.name}`).catch(() => {});
  return ok(reservation);
}
