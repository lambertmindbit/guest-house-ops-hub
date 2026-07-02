import { prisma } from "@/lib/prisma";

// A booking group is a folio wrapper. It NEVER creates reservations — children
// are created through the guarded reservation path and only linked here — so the
// no-double-booking guarantee is untouched.

export async function listGroups() {
  return prisma.bookingGroup.findMany({
    orderBy: { createdAt: "desc" },
    include: { reservations: { select: { id: true } } },
  });
}

export async function createGroup(data: { name: string; guestId?: string | null; notes?: string | null }) {
  return prisma.bookingGroup.create({ data: { name: data.name, guestId: data.guestId ?? null, notes: data.notes ?? null } });
}

export async function getGroup(id: string) {
  return prisma.bookingGroup.findUnique({
    where: { id },
    include: {
      reservations: {
        include: {
          guest: { select: { name: true } },
          room: { select: { label: true } },
          payments: { select: { amount: true } },
        },
        orderBy: { checkIn: "asc" },
      },
    },
  });
}

export async function setReservationGroup(reservationId: string, groupId: string | null) {
  return prisma.reservation.update({ where: { id: reservationId }, data: { groupId } });
}

// Confirmed bookings not yet in a group — candidates to attach.
export async function ungroupedReservations() {
  return prisma.reservation.findMany({
    where: { groupId: null, status: "confirmed" },
    include: { guest: { select: { name: true } }, room: { select: { label: true } } },
    orderBy: { checkIn: "desc" },
    take: 100,
  });
}

// ── Pure folio (testable) ────────────────────────────────────────────────────
export type FolioChild = { gross: number | null; collected: number };
export function folioTotal(children: FolioChild[]): { gross: number; collected: number; balance: number } {
  let gross = 0;
  let collected = 0;
  for (const c of children) {
    gross += c.gross ?? 0;
    collected += c.collected;
  }
  return { gross, collected, balance: Math.max(0, gross - collected) };
}
