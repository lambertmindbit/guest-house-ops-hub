import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { isOverlapError } from "@/lib/db-errors";
import { agentTokenOk } from "@/lib/agent-auth";
import { notifyBookingConfirmation } from "@/lib/messaging";

// POST /api/agent/reservations
//
// The agent booking path. Token-gated by AGENT_TOKEN (see agent-auth.ts).
// Confirmed immediately for simple, OTP-verified bookings; anything non-trivial
// should be filed as an escalation via POST /api/agent/escalations instead.
//
// Uses the same guest-upsert + reservation.create transaction as the owner route
// so the no_overlapping_confirmed_stays GiST constraint always governs the write.
// An overlap returns 409 — the agent must escalate rather than retry.

const schema = z
  .object({
    roomId: z.string().min(1),
    channelId: z.string().min(1),
    checkIn: dateOnly,
    checkOut: dateOnly,
    guestId: z.string().min(1).optional(),
    guest: z
      .object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional(),
      })
      .optional(),
    otaRef: z.string().optional(),
    arrivalTime: z.string().optional(),
    specialRequests: z.string().optional(),
    grossAmount: z.number().nonnegative().optional(),
    /** Forward-compatible tenant hint; accepted, not yet persisted. */
    propertyRef: z.string().optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    path: ["checkOut"],
    message: "checkOut must be after checkIn",
  })
  .refine((d) => d.guestId || d.guest, {
    path: ["guest"],
    message: "provide guestId or guest details",
  });

const reservationInclude = {
  guest: true,
  channel: true,
  room: { include: { roomType: true } },
} as const;

class MissingGuestError extends Error {}

async function handlePOST(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 422);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      let guestId = input.guestId;
      if (!guestId && input.guest) {
        const guest = await tx.guest.upsert({
          where: { phone: input.guest.phone },
          update: { name: input.guest.name, email: input.guest.email },
          create: input.guest,
        });
        guestId = guest.id;
      }
      if (!guestId) throw new MissingGuestError();

      return tx.reservation.create({
        data: {
          roomId: input.roomId,
          guestId,
          channelId: input.channelId,
          checkIn: parseDateOnly(input.checkIn),
          checkOut: parseDateOnly(input.checkOut),
          otaRef: input.otaRef,
          arrivalTime: input.arrivalTime,
          specialRequests: input.specialRequests,
          grossAmount: input.grossAmount,
        },
      });
    });

    const full = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: reservationInclude,
    });
    // Log a booking confirmation (best-effort — never fail the booking on this).
    await notifyBookingConfirmation(reservation.id).catch(() => {});
    return ok(full, 201);
  } catch (error) {
    if (error instanceof MissingGuestError) return fail("provide guestId or guest details", 422);
    if (isOverlapError(error)) return fail("Those dates are no longer available for this room.", 409);
    throw error;
  }
}

export const POST = withRoute(handlePOST);
