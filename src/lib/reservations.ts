import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isOverlapError } from "@/lib/db-errors";

// Thrown when a write hits the no_overlapping_confirmed_stays constraint, so
// route handlers can turn it into a friendly 409 instead of a raw 500.
export class OverlapError extends Error {
  constructor() {
    super("Those dates are no longer available for this room.");
    this.name = "OverlapError";
  }
}

export async function createReservation(data: Prisma.ReservationUncheckedCreateInput) {
  try {
    return await prisma.reservation.create({ data });
  } catch (error) {
    if (isOverlapError(error)) throw new OverlapError();
    throw error;
  }
}

export async function updateReservation(
  id: string,
  data: Prisma.ReservationUncheckedUpdateInput,
) {
  try {
    return await prisma.reservation.update({ where: { id }, data });
  } catch (error) {
    if (isOverlapError(error)) throw new OverlapError();
    throw error;
  }
}
