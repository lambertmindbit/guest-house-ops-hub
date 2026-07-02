import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { noShowStats, isRepeatOffender } from "@/lib/community/reliability";
import { reportGuestAlert } from "@/lib/community/badguest";
import { recordAudit } from "@/lib/audit";
import { formatDateOnly } from "@/lib/dates";

// Create a shared repeat-no-show alert for a guest. Owner-only. Stats are
// RECOMPUTED server-side (never taken from the client) so the conservative
// threshold can't be gamed. The alert enters the normal bad-guest workflow
// (submitted → the owner verifies to share → appealable).

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "owner") return fail("Owners only.", 403);
  if (!session.propertyId) return fail("No property is bound to your account.", 400);

  const { id } = await params;
  const guest = await prisma.guest.findUnique({
    where: { id },
    include: { reservations: { select: { status: true, checkIn: true } } },
  });
  if (!guest) return fail("Guest not found.", 404);

  const stats = noShowStats(guest.reservations.map((r) => r.status));
  if (!isRepeatOffender(stats)) return fail("This guest is not a repeat no-show.", 400);

  const noShowDates = guest.reservations
    .filter((r) => r.status === "no_show")
    .map((r) => formatDateOnly(r.checkIn))
    .join(", ");

  const result = await reportGuestAlert(session.propertyId, {
    phone: guest.phone,
    guestName: guest.name,
    category: "no_show",
    reason: `${stats.noShows} no-shows out of ${stats.total} bookings`,
    evidenceNote: `No-show dates: ${noShowDates}`,
    createdByUserId: session.sub,
  });
  if (!result.ok) return fail(result.error, 400);

  await recordAudit("community.reliability.flag", "shared_guest_alert", result.id, `Flagged ${guest.name} as a repeat no-show`).catch(() => {});
  return ok({ id: result.id }, 201);
}
