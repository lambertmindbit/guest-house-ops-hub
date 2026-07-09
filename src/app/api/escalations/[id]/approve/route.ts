import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { isOverlapError } from "@/lib/db-errors";
import { notifyBookingConfirmation } from "@/lib/messaging";

// POST /api/escalations/[id]/approve
//
// One-tap approval for a booking-request escalation (filed by the public chat
// widget — an anonymous guest can never create a confirmed reservation, so their
// "Confirm" only ever files this request; see CLAUDE.md's HITL rule). The owner
// reviewing it is the human in the loop; approving here creates the reservation
// through the SAME guest-upsert + guarded create used by the manual booking form
// (POST /api/reservations), so the no_overlapping_confirmed_stays GiST
// constraint still governs it. A conflict (409) leaves the escalation open so
// the owner can pick another room/date rather than losing the request.

type Ctx = { params: Promise<{ id: string }> };

const metaSchema = z.object({
  roomId: z.string().min(1),
  checkIn: dateOnly,
  checkOut: dateOnly,
  guestName: z.string().min(1),
  guestPhone: z.string().min(1),
  total: z.number().optional(),
});

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;

  const escalation = await prisma.escalation.findUnique({ where: { id } });
  if (!escalation) return fail("Request not found", 404);
  if (escalation.status === "resolved" || escalation.status === "dismissed") {
    return fail("This request has already been handled.", 409);
  }

  const meta = metaSchema.safeParse(escalation.metadata);
  if (!meta.success) {
    return fail("This request doesn't have enough details to book automatically — open it and book manually.", 422);
  }
  const { roomId, checkIn, checkOut, guestName, guestPhone, total } = meta.data;

  // Attribute the booking to the assistant channel, but don't hard-fail if the
  // owner has renamed it: prefer an exact match, then any channel whose name
  // mentions "assistant", then Direct (0% commission — a safe, non-OTA default),
  // then any channel at all. Only 500 if the property has no channels at all.
  const channel =
    (await prisma.channel.findFirst({ where: { name: "Assistant (ROOT)" } })) ??
    (await prisma.channel.findFirst({ where: { name: { contains: "assistant", mode: "insensitive" } } })) ??
    (await prisma.channel.findFirst({ where: { name: { equals: "Direct", mode: "insensitive" } } })) ??
    (await prisma.channel.findFirst({ orderBy: { name: "asc" } }));
  if (!channel) return fail("No channel is configured — add one under Settings > Channels first.", 500);

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const guest = await tx.guest.upsert({
        where: { phone: guestPhone },
        update: { name: guestName },
        create: { name: guestName, phone: guestPhone },
      });

      return tx.reservation.create({
        data: {
          roomId,
          guestId: guest.id,
          channelId: channel.id,
          checkIn: parseDateOnly(checkIn),
          checkOut: parseDateOnly(checkOut),
          grossAmount: total,
        },
      });
    });

    await prisma.escalation.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        firstResponseAt: escalation.firstResponseAt ?? new Date(),
        relatedType: "reservation",
        relatedId: reservation.id,
        resolutionNote: `Approved and booked — reservation created.`,
      },
    });

    // Best-effort — never fail the approval on this.
    await notifyBookingConfirmation(reservation.id).catch(() => {});

    const full = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: { guest: true, channel: true, room: { include: { roomType: true } } },
    });
    return ok(full, 201);
  } catch (error) {
    if (isOverlapError(error)) {
      return fail("Those dates are no longer available for this room — the request is still open so you can pick another.", 409);
    }
    throw error;
  }
}
