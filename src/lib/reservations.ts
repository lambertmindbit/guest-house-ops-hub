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

// Thrown when an edit carries a stale version — the booking changed since it was
// loaded (another device saved first). Route handlers surface this as a 409.
export class StaleWriteError extends Error {
  constructor() {
    super("This booking changed since you opened it. Reload and try again.");
    this.name = "StaleWriteError";
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

// Every update bumps `version`. When `expectedVersion` is given (the owner form),
// the write is a conditional updateMany gated on that version — a mismatch means
// someone else saved first, so we throw StaleWriteError instead of clobbering.
// Callers without a version (agent/import) update unconditionally, still bumping.
export async function updateReservation(
  id: string,
  data: Prisma.ReservationUncheckedUpdateInput,
  expectedVersion?: number,
) {
  try {
    if (expectedVersion === undefined) {
      return await prisma.reservation.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
    }
    const res = await prisma.reservation.updateMany({
      where: { id, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (res.count === 0) throw new StaleWriteError();
    return await prisma.reservation.findUnique({ where: { id } });
  } catch (error) {
    if (isOverlapError(error)) throw new OverlapError();
    throw error;
  }
}
