import { prisma } from "@/lib/prisma";
import { ok, fail, withRoute } from "@/lib/api";
import { updateReservation, OverlapError } from "@/lib/reservations";
import { recordAudit } from "@/lib/audit";

// GAP-2: apply a matched OTA modification/cancellation to the linked booking,
// through the SAME guarded path as any edit (so an overlap surfaces as 409, never
// a silent oversell). New confirmations still go through Create, not here.
async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.inboundBooking.findUnique({ where: { id } });
  if (!item) return fail("inbound item not found", 404);
  if (item.status !== "pending") return fail("This item has already been handled.", 409);
  if (!item.reservationId) return fail("This item isn't linked to a booking to update.", 422);
  const reservation = await prisma.reservation.findUnique({ where: { id: item.reservationId } });
  if (!reservation) return fail("The linked booking no longer exists.", 404);

  try {
    if (item.emailKind === "cancellation") {
      await updateReservation(item.reservationId, { status: "cancelled" });
      await recordAudit("reservation.cancel", "reservation", item.reservationId, "Cancelled via OTA cancellation email").catch(() => {});
    } else if (item.emailKind === "modification") {
      const nextCheckIn = item.checkIn ?? reservation.checkIn;
      const nextCheckOut = item.checkOut ?? reservation.checkOut;
      if (nextCheckOut <= nextCheckIn) return fail("The modified dates are invalid (check-out must be after check-in).", 422);
      await updateReservation(item.reservationId, {
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        ...(item.amount != null ? { grossAmount: item.amount } : {}),
      });
      await recordAudit("reservation.modify", "reservation", item.reservationId, "Applied OTA modification").catch(() => {});
    } else {
      return fail("This is a new booking — use Create, not Apply.", 422);
    }
    await prisma.inboundBooking.update({ where: { id }, data: { status: "imported" } });
    return ok({ applied: true });
  } catch (error) {
    if (error instanceof OverlapError) return fail(error.message, 409);
    throw error;
  }
}

export const POST = withRoute(handlePOST);
