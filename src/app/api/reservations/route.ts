import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { createReservation, OverlapError } from "@/lib/reservations";

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
      })
      .optional(),
    otaRef: z.string().optional(),
    arrivalTime: z.string().optional(),
    specialRequests: z.string().optional(),
    grossAmount: z.number().nonnegative().optional(),
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

  // Resolve the guest: upsert by phone keeps repeat guests as a single record.
  let guestId = input.guestId;
  if (!guestId && input.guest) {
    const guest = await prisma.guest.upsert({
      where: { phone: input.guest.phone },
      update: { name: input.guest.name, email: input.guest.email },
      create: input.guest,
    });
    guestId = guest.id;
  }
  if (!guestId) return fail("provide guestId or guest details", 422);

  try {
    const reservation = await createReservation({
      roomId: input.roomId,
      guestId,
      channelId: input.channelId,
      checkIn: parseDateOnly(input.checkIn),
      checkOut: parseDateOnly(input.checkOut),
      otaRef: input.otaRef,
      arrivalTime: input.arrivalTime,
      specialRequests: input.specialRequests,
      grossAmount: input.grossAmount,
    });
    const full = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: reservationInclude,
    });
    return ok(full, 201);
  } catch (error) {
    if (error instanceof OverlapError) return fail(error.message, 409);
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
