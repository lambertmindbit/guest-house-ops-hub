import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { updateReservation, OverlapError, StaleWriteError } from "@/lib/reservations";

const include = {
  guest: true,
  channel: true,
  room: { include: { roomType: true } },
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reservation = await prisma.reservation.findUnique({ where: { id }, include });
  if (!reservation) return fail("reservation not found", 404);
  return ok(reservation);
}

const updateSchema = z
  .object({
    roomId: z.string().min(1).optional(),
    channelId: z.string().min(1).optional(),
    checkIn: dateOnly.optional(),
    checkOut: dateOnly.optional(),
    status: z.enum(["confirmed", "cancelled", "no_show"]).optional(),
    arrivalTime: z.string().nullable().optional(),
    specialRequests: z.string().nullable().optional(),
    grossAmount: z.number().nonnegative().nullable().optional(),
    advanceRequired: z.number().nonnegative().nullable().optional(),
    otaRef: z.string().nullable().optional(),
    // Optimistic-concurrency token the edit form round-trips (see L-4).
    expectedVersion: z.number().int().optional(),
  })
  .refine((d) => !(d.checkIn && d.checkOut) || d.checkOut > d.checkIn, {
    path: ["checkOut"],
    message: "check-out must be after check-in",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) return fail("reservation not found", 404);

  // If only one date changes, validate the new range against the stored one.
  const nextCheckIn = input.checkIn ? parseDateOnly(input.checkIn) : existing.checkIn;
  const nextCheckOut = input.checkOut ? parseDateOnly(input.checkOut) : existing.checkOut;
  if (nextCheckOut <= nextCheckIn) {
    return fail("check-out must be after check-in", 422);
  }

  try {
    await updateReservation(id, {
      roomId: input.roomId,
      channelId: input.channelId,
      checkIn: input.checkIn ? nextCheckIn : undefined,
      checkOut: input.checkOut ? nextCheckOut : undefined,
      status: input.status,
      arrivalTime: input.arrivalTime,
      specialRequests: input.specialRequests,
      grossAmount: input.grossAmount,
      advanceRequired: input.advanceRequired,
      otaRef: input.otaRef,
    }, input.expectedVersion);
    const full = await prisma.reservation.findUnique({ where: { id }, include });
    return ok(full);
  } catch (error) {
    if (error instanceof OverlapError) return fail(error.message, 409);
    if (error instanceof StaleWriteError) return fail(error.message, 409);
    throw error;
  }
}
