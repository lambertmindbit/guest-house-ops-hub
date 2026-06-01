import { prisma } from "@/lib/prisma";
import { todayDateOnly, parseDateOnly, formatDateOnly } from "@/lib/dates";

export type HousekeepingRoom = {
  id: string;
  label: string;
  roomTypeName: string;
  needsCleaning: boolean;
  lastDeparture: string | null;
  arrivalToday: boolean;
  occupiedTonight: boolean;
  highPriority: boolean;
};

export type Housekeeping = {
  rooms: HousekeepingRoom[];
  toCleanCount: number;
};

// A room needs cleaning when a guest has departed (checkout on/before today)
// since it was last marked clean. A pending same-day arrival into an un-cleaned
// room is high priority — the guest is coming and the room isn't ready.
export async function getHousekeeping(): Promise<Housekeeping> {
  const today = todayDateOnly();
  const todayDate = parseDateOnly(today);

  const [rooms, departures, arrivalsToday, occupiedTonight] = await Promise.all([
    prisma.room.findMany({
      include: { roomType: true },
      orderBy: [{ roomType: { name: "asc" } }, { label: "asc" }],
    }),
    // Most recent checkout on/before today, per room.
    prisma.reservation.groupBy({
      by: ["roomId"],
      where: { status: "confirmed", checkOut: { lte: todayDate } },
      _max: { checkOut: true },
    }),
    prisma.reservation.findMany({
      where: { status: "confirmed", checkIn: todayDate },
      select: { roomId: true },
    }),
    prisma.reservation.findMany({
      where: { status: "confirmed", checkIn: { lte: todayDate }, checkOut: { gt: todayDate } },
      select: { roomId: true },
    }),
  ]);

  const lastDepartureByRoom = new Map(departures.map((d) => [d.roomId, d._max.checkOut]));
  const arrivingTodayRooms = new Set(arrivalsToday.map((r) => r.roomId));
  const occupiedRooms = new Set(occupiedTonight.map((r) => r.roomId));

  const result: HousekeepingRoom[] = rooms.map((room) => {
    const lastDeparture = lastDepartureByRoom.get(room.id) ?? null;
    const needsCleaning =
      lastDeparture !== null &&
      (room.lastCleanedAt === null || room.lastCleanedAt < lastDeparture);
    const arrivalToday = arrivingTodayRooms.has(room.id);

    return {
      id: room.id,
      label: room.label,
      roomTypeName: room.roomType.name,
      needsCleaning,
      lastDeparture: lastDeparture ? formatDateOnly(lastDeparture) : null,
      arrivalToday,
      occupiedTonight: occupiedRooms.has(room.id),
      highPriority: needsCleaning && arrivalToday,
    };
  });

  return { rooms: result, toCleanCount: result.filter((r) => r.needsCleaning).length };
}
