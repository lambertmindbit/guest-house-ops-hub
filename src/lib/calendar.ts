import { prisma } from "@/lib/prisma";
import { addDays, formatDateOnly } from "@/lib/dates";

// The pure grid shape (cells, segments, toSegments) lives in ./calendar-grid so
// the client-side CalendarBoard can import it without dragging Prisma into the
// browser bundle. Re-exported here so server callers have one import site.
export type { CellState, CalendarCell, CalendarSegment } from "./calendar-grid";
export { toSegments } from "./calendar-grid";

import type { CalendarCell, CellState } from "./calendar-grid";

export type CalendarRow = {
  id: string;
  label: string;
  roomTypeName: string;
  cells: CalendarCell[];
};

export type Calendar = {
  start: string;
  days: number;
  dates: string[];
  rows: CalendarRow[];
};

// Builds the rooms × dates grid. Availability/occupancy is derived live from
// confirmed reservations + blocks — nothing here reads a stored counter.
// A cell is a "conflict" (red) when the same room is BOTH reserved and blocked
// on the same night; the DB already prevents two confirmed stays from
// overlapping, so that's the realistic clash the owner needs flagged.
export async function getCalendar(
  start: string,
  days: number,
  { includeMoney = false }: { includeMoney?: boolean } = {},
): Promise<Calendar> {
  const end = addDays(start, days);
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));

  const [rooms, reservations, blocks] = await Promise.all([
    prisma.room.findMany({
      where: { archivedAt: null },
      include: { roomType: true },
      orderBy: [{ roomType: { name: "asc" } }, { label: "asc" }],
    }),
    prisma.reservation.findMany({
      where: {
        status: "confirmed",
        checkIn: { lt: new Date(`${end}T00:00:00.000Z`) },
        checkOut: { gt: new Date(`${start}T00:00:00.000Z`) },
      },
      include: { guest: true, channel: true, payments: true },
    }),
    prisma.block.findMany({
      where: {
        startDate: { lt: new Date(`${end}T00:00:00.000Z`) },
        endDate: { gt: new Date(`${start}T00:00:00.000Z`) },
      },
    }),
  ]);

  // Pre-stringify the ranges once so per-cell checks are simple string compares
  // (YYYY-MM-DD sorts lexicographically, half-open [in, out)).
  const DAY_MS = 86_400_000;
  const res = reservations.map((r) => {
    const collected = r.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Number(r.grossAmount ?? 0) - collected;
    return {
      id: r.id,
      roomId: r.roomId,
      checkIn: formatDateOnly(r.checkIn),
      checkOut: formatDateOnly(r.checkOut),
      guestName: r.guest.name,
      channelName: r.channel.name,
      nights: Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / DAY_MS),
      // Payments are always read (they're a handful of rows), but the figure only
      // reaches the client for roles allowed to see money — a housekeeping login
      // must not be able to read balances out of the page payload.
      balanceDue: includeMoney && balance > 0 ? balance : undefined,
    };
  });
  const blk = blocks.map((b) => ({
    roomId: b.roomId,
    start: formatDateOnly(b.startDate),
    end: formatDateOnly(b.endDate),
    reason: b.reason,
  }));

  const rows: CalendarRow[] = rooms.map((room) => {
    const cells = dates.map((date): CalendarCell => {
      const occupying = res.find(
        (r) => r.roomId === room.id && r.checkIn <= date && date < r.checkOut,
      );
      const arriving = res.some((r) => r.roomId === room.id && r.checkIn === date);
      const departing = res.some((r) => r.roomId === room.id && r.checkOut === date);
      const block = blk.find(
        (b) => b.roomId === room.id && b.start <= date && date < b.end,
      );

      let state: CellState = "vacant";
      if (occupying && block) state = "conflict";
      else if (occupying) state = "occupied";
      else if (block) state = "blocked";

      return {
        date,
        state,
        arriving,
        departing,
        reservation: occupying
          ? {
              id: occupying.id,
              guestName: occupying.guestName,
              channelName: occupying.channelName,
              nights: occupying.nights,
              balanceDue: occupying.balanceDue,
            }
          : undefined,
        blockReason: block?.reason,
      };
    });

    return {
      id: room.id,
      label: room.label,
      roomTypeName: room.roomType.name,
      cells,
    };
  });

  return { start, days, dates, rows };
}
