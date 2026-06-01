import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api";
import { todayDateOnly, parseDateOnly, addDays } from "@/lib/dates";

const include = {
  guest: true,
  channel: true,
  room: { include: { roomType: true } },
} as const;

// Today-dashboard summary. All "today" math uses the property's local date.
export async function GET() {
  const today = todayDateOnly();
  const todayDate = parseDateOnly(today);
  const tomorrowDate = parseDateOnly(addDays(today, 1));
  const in7Date = parseDateOnly(addDays(today, 7));

  const confirmed = { status: "confirmed" as const };

  const [checkInsToday, checkOutsToday, inHouse, arrivalsNext7, totalRooms] =
    await Promise.all([
      prisma.reservation.findMany({
        where: { ...confirmed, checkIn: todayDate },
        include,
        orderBy: { arrivalTime: "asc" },
      }),
      prisma.reservation.findMany({
        where: { ...confirmed, checkOut: todayDate },
        include,
      }),
      // In-house tonight: checked in on/before today and checking out after today.
      prisma.reservation.findMany({
        where: { ...confirmed, checkIn: { lte: todayDate }, checkOut: { gt: todayDate } },
        include,
      }),
      // Arrivals over the next 7 days (excluding today's, which are above).
      prisma.reservation.findMany({
        where: { ...confirmed, checkIn: { gte: tomorrowDate, lte: in7Date } },
        include,
        orderBy: { checkIn: "asc" },
      }),
      prisma.room.count(),
    ]);

  const occupancyPct =
    totalRooms === 0 ? 0 : Math.round((inHouse.length / totalRooms) * 100);

  return ok({
    date: today,
    occupancyPct,
    totalRooms,
    occupiedRooms: inHouse.length,
    checkInsToday,
    checkOutsToday,
    inHouse,
    arrivalsNext7,
  });
}
