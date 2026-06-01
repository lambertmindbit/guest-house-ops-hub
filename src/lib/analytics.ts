import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";

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
};

// All metrics are over the nights in [from, to). A stay contributes only the
// nights that fall inside the window; revenue is prorated by those nights so a
// booking straddling the period boundary is counted fairly.
export async function getAnalytics(from: string, to: string): Promise<Analytics> {
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  const nights = nightsBetween(fromDate, toDate);

  const [rooms, overlapping, arriving] = await Promise.all([
    prisma.room.count(),
    // Confirmed stays overlapping the window drive occupancy/ADR/RevPAR/mix.
    prisma.reservation.findMany({
      where: { status: "confirmed", checkIn: { lt: toDate }, checkOut: { gt: fromDate } },
      include: { channel: true },
    }),
    // Everything arriving in the window drives cancellation rate + avg LOS.
    prisma.reservation.findMany({
      where: { checkIn: { gte: fromDate, lt: toDate } },
      select: { status: true, checkIn: true, checkOut: true },
    }),
  ]);

  const availableRoomNights = rooms * nights;
  let soldRoomNights = 0;
  let revenue = 0;
  const sourceMap = new Map<string, { bookings: number; roomNights: number }>();

  for (const r of overlapping) {
    const stayStart = r.checkIn > fromDate ? r.checkIn : fromDate;
    const stayEnd = r.checkOut < toDate ? r.checkOut : toDate;
    const nightsInWindow = nightsBetween(stayStart, stayEnd);
    if (nightsInWindow === 0) continue;

    const totalNights = nightsBetween(r.checkIn, r.checkOut) || 1;
    soldRoomNights += nightsInWindow;
    revenue += num(r.grossAmount) * (nightsInWindow / totalNights);

    const row = sourceMap.get(r.channel.name) ?? { bookings: 0, roomNights: 0 };
    row.bookings += 1;
    row.roomNights += nightsInWindow;
    sourceMap.set(r.channel.name, row);
  }

  const confirmedArriving = arriving.filter((r) => r.status === "confirmed");
  const cancelledArriving = arriving.filter((r) => r.status === "cancelled").length;
  const losTotal = confirmedArriving.reduce((s, r) => s + nightsBetween(r.checkIn, r.checkOut), 0);

  const sourceMix: SourceRow[] = [...sourceMap.entries()]
    .map(([channel, v]) => ({
      channel,
      bookings: v.bookings,
      roomNights: v.roomNights,
      sharePct: soldRoomNights === 0 ? 0 : (v.roomNights / soldRoomNights) * 100,
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
  };
}
