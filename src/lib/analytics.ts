import { prisma } from "@/lib/prisma";
import { parseDateOnly, formatDateOnly } from "@/lib/dates";

const DAY_MS = 86_400_000;

function num(value: { toString(): string } | null): number {
  return value === null ? 0 : Number(value);
}

function nightsBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY_MS));
}

export type SourceRow = {
  channel: string;
  bookings: number;
  roomNights: number;
  sharePct: number;
  revenue: number; // prorated gross revenue attributable to this channel in the window
};

export type TrendPoint = { date: string; occupancyPct: number };

export type RoomTypeRow = {
  name: string;
  soldRoomNights: number;
  availableRoomNights: number;
  occupancyPct: number;
};

export type Analytics = {
  from: string;
  to: string;
  nights: number;
  rooms: number;
  availableRoomNights: number;
  soldRoomNights: number;
  occupancyPct: number;
  adr: number;
  revpar: number;
  avgLengthOfStay: number;
  cancellationPct: number;
  bookingsArriving: number;
  sourceMix: SourceRow[];
  trend: TrendPoint[];
  byRoomType: RoomTypeRow[];
};

// All metrics are over the nights in [from, to). A stay contributes only the
// nights that fall inside the window; revenue is prorated by those nights so a
// booking straddling the period boundary is counted fairly.
export async function getAnalytics(from: string, to: string): Promise<Analytics> {
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  const nights = nightsBetween(fromDate, toDate);

  const [roomList, overlapping, arriving] = await Promise.all([
    prisma.room.findMany({ select: { roomType: { select: { name: true } } } }),
    // Confirmed stays overlapping the window drive occupancy/ADR/RevPAR/mix.
    // Select only the fields the loop below reads, not whole related rows.
    prisma.reservation.findMany({
      where: { status: "confirmed", checkIn: { lt: toDate }, checkOut: { gt: fromDate } },
      select: {
        checkIn: true,
        checkOut: true,
        grossAmount: true,
        channel: { select: { name: true } },
        room: { select: { roomType: { select: { name: true } } } },
      },
    }),
    // Everything arriving in the window drives cancellation rate + avg LOS.
    prisma.reservation.findMany({
      where: { checkIn: { gte: fromDate, lt: toDate } },
      select: { status: true, checkIn: true, checkOut: true },
    }),
  ]);

  const rooms = roomList.length;
  const availableRoomNights = rooms * nights;
  let soldRoomNights = 0;
  let revenue = 0;
  const sourceMap = new Map<string, { bookings: number; roomNights: number; revenue: number }>();
  // Per-night occupied-room count (for the trend) and per-room-type sold nights.
  const dayCount = new Array<number>(Math.max(0, nights)).fill(0);
  const typeSold = new Map<string, number>();

  for (const r of overlapping) {
    const stayStart = r.checkIn > fromDate ? r.checkIn : fromDate;
    const stayEnd = r.checkOut < toDate ? r.checkOut : toDate;
    const nightsInWindow = nightsBetween(stayStart, stayEnd);
    if (nightsInWindow === 0) continue;

    const totalNights = nightsBetween(r.checkIn, r.checkOut) || 1;
    soldRoomNights += nightsInWindow;
    const prorated = num(r.grossAmount) * (nightsInWindow / totalNights);
    revenue += prorated;

    const row = sourceMap.get(r.channel.name) ?? { bookings: 0, roomNights: 0, revenue: 0 };
    row.bookings += 1;
    row.roomNights += nightsInWindow;
    row.revenue += prorated;
    sourceMap.set(r.channel.name, row);

    typeSold.set(r.room.roomType.name, (typeSold.get(r.room.roomType.name) ?? 0) + nightsInWindow);

    const startIdx = Math.round((stayStart.getTime() - fromDate.getTime()) / DAY_MS);
    const endIdx = Math.round((stayEnd.getTime() - fromDate.getTime()) / DAY_MS);
    for (let i = Math.max(0, startIdx); i < Math.min(nights, endIdx); i++) dayCount[i] += 1;
  }

  const trend: TrendPoint[] = dayCount.map((c, i) => ({
    date: formatDateOnly(new Date(fromDate.getTime() + i * DAY_MS)),
    occupancyPct: rooms === 0 ? 0 : (c / rooms) * 100,
  }));

  // Rooms grouped by type → per-type available + sold room-nights.
  const typeRoomCount = new Map<string, number>();
  for (const rm of roomList) typeRoomCount.set(rm.roomType.name, (typeRoomCount.get(rm.roomType.name) ?? 0) + 1);
  const byRoomType: RoomTypeRow[] = [...typeRoomCount.entries()]
    .map(([name, roomCount]) => {
      const avail = roomCount * nights;
      const sold = typeSold.get(name) ?? 0;
      return { name, soldRoomNights: sold, availableRoomNights: avail, occupancyPct: avail === 0 ? 0 : (sold / avail) * 100 };
    })
    .sort((a, b) => b.occupancyPct - a.occupancyPct);

  const confirmedArriving = arriving.filter((r) => r.status === "confirmed");
  const cancelledArriving = arriving.filter((r) => r.status === "cancelled").length;
  const losTotal = confirmedArriving.reduce((s, r) => s + nightsBetween(r.checkIn, r.checkOut), 0);

  const sourceMix: SourceRow[] = [...sourceMap.entries()]
    .map(([channel, v]) => ({
      channel,
      bookings: v.bookings,
      roomNights: v.roomNights,
      sharePct: soldRoomNights === 0 ? 0 : (v.roomNights / soldRoomNights) * 100,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.roomNights - a.roomNights);

  return {
    from,
    to,
    nights,
    rooms,
    availableRoomNights,
    soldRoomNights,
    occupancyPct: availableRoomNights === 0 ? 0 : (soldRoomNights / availableRoomNights) * 100,
    adr: soldRoomNights === 0 ? 0 : revenue / soldRoomNights,
    revpar: availableRoomNights === 0 ? 0 : revenue / availableRoomNights,
    avgLengthOfStay: confirmedArriving.length === 0 ? 0 : losTotal / confirmedArriving.length,
    cancellationPct: arriving.length === 0 ? 0 : (cancelledArriving / arriving.length) * 100,
    bookingsArriving: arriving.length,
    sourceMix,
    trend,
    byRoomType,
  };
}
