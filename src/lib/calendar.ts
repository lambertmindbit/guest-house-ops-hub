import { prisma } from "@/lib/prisma";
import { addDays, formatDateOnly } from "@/lib/dates";

export type CellState = "vacant" | "occupied" | "blocked" | "conflict";

export type CalendarCell = {
  date: string;
  state: CellState;
  arriving: boolean;
  departing: boolean;
  reservation?: { id: string; guestName: string; channelName: string };
  blockReason?: string | null;
};

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
export async function getCalendar(start: string, days: number): Promise<Calendar> {
  const end = addDays(start, days);
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));

  const [rooms, reservations, blocks] = await Promise.all([
    prisma.room.findMany({
      include: { roomType: true },
      orderBy: [{ roomType: { name: "asc" } }, { label: "asc" }],
    }),
    prisma.reservation.findMany({
      where: {
        status: "confirmed",
        checkIn: { lt: new Date(`${end}T00:00:00.000Z`) },
        checkOut: { gt: new Date(`${start}T00:00:00.000Z`) },
      },
      include: { guest: true, channel: true },
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
  const res = reservations.map((r) => ({
    id: r.id,
    roomId: r.roomId,
    checkIn: formatDateOnly(r.checkIn),
    checkOut: formatDateOnly(r.checkOut),
    guestName: r.guest.name,
    channelName: r.channel.name,
  }));
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
          ? { id: occupying.id, guestName: occupying.guestName, channelName: occupying.channelName }
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
