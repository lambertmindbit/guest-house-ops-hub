import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { isOverlapError } from "@/lib/db-errors";
import { notifyBookingConfirmation } from "@/lib/messaging";

// Thrown inside the create transaction when neither a guestId nor guest details
// resolved to a guest — surfaced as a 422.
class MissingGuestError extends Error {}

const createSchema = z
  .object({
    roomId: z.string().min(1),
    channelId: z.string().min(1),
    checkIn: dateOnly,
    checkOut: dateOnly,
    // Either reference an existing guest or supply enough to upsert one by phone.
    guestId: z.string().min(1).optional(),
    guest: z
      .object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional(),
        idNumber: z.string().optional(),
      })
      .optional(),
    otaRef: z.string().optional(),
    arrivalTime: z.string().optional(),
    specialRequests: z.string().optional(),
    grossAmount: z.number().nonnegative().optional(),
    advanceRequired: z.number().nonnegative().optional(),
    // The booker confirmed the guest accepts that a valid ID is collected at
    // check-in. Recorded (idAckAt) but not required server-side, so OTA/agent/
    // import paths still work; the manual form enforces the tick client-side.
    idAck: z.boolean().optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    path: ["checkOut"],
    message: "check-out must be after check-in",
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  // Walk-in-only properties can require an ID number to save a new booking.
  if (input.guest && !input.guest.idNumber?.trim()) {
    const settings = await prisma.propertySettings.findFirst({ select: { idRequiredAtBooking: true } });
    if (settings?.idRequiredAtBooking) return fail("This property requires a guest ID number to take a booking.", 422);
  }

  // Guest upsert + reservation insert run in ONE transaction so an overlap
  // rejection (or any failure) rolls the guest back — no orphan guest records
  // left behind by a booking that never completed.
  try {
    const reservation = await prisma.$transaction(async (tx) => {
      let guestId = input.guestId;
      if (!guestId && input.guest) {
        const idNumber = input.guest.idNumber?.trim() || undefined;
        const guest = await tx.guest.upsert({
          where: { phone: input.guest.phone },
          update: { name: input.guest.name, email: input.guest.email, ...(idNumber ? { idNumber } : {}) },
          create: { name: input.guest.name, phone: input.guest.phone, email: input.guest.email, idNumber },
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
          advanceRequired: input.advanceRequired,
          idAckAt: input.idAck ? new Date() : null,
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
    if (isOverlapError(error)) {
      return fail("Those dates are no longer available for this room.", 409);
    }
    throw error;
  }
}

const listSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = listSchema.safeParse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error);
  const { from, to } = parsed.data;

  // Overlap filter: a stay intersects [from, to) when it starts before `to`
  // and ends after `from`.
  const where =
    from && to
      ? {
          checkIn: { lt: parseDateOnly(to) },
          checkOut: { gt: parseDateOnly(from) },
        }
      : {};

  const reservations = await prisma.reservation.findMany({
    where,
    include: reservationInclude,
    orderBy: { checkIn: "asc" },
  });
  return ok(reservations);
}
