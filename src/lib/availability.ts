import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/dates";

export type NightAvailability = {
  date: string;
  total: number;
  available: number;
};

// Availability is DERIVED, never stored. For each night in [from, to), a room
// of this type is unavailable if it has a confirmed reservation OR a block
// covering that night. We count DISTINCT occupied rooms (a room that is both
// reserved and blocked still only consumes one unit), then subtract from the
// number of rooms of the type. The `@>` checks use the half-open daterange
// columns, so a checkout day is free for a same-day arrival.
export async function getAvailability(
  roomTypeId: string,
  from: string,
  to: string,
): Promise<NightAvailability[]> {
  const rows = await prisma.$queryRaw<
    { night: Date; total: number; available: number }[]
  >`
    WITH type_rooms AS (
      -- Defence in depth: pin to the room type's OWN property so a room whose
      -- property_id disagrees with its type (or any future id reuse) can't leak
      -- across tenants. This raw SQL is invisible to the Prisma tenant extension.
      SELECT id FROM rooms
       WHERE room_type_id = ${roomTypeId}
         AND archived_at IS NULL
         AND property_id IS NOT DISTINCT FROM (SELECT property_id FROM room_types WHERE id = ${roomTypeId})
    ),
    nights AS (
      SELECT generate_series(${from}::date, ${to}::date - 1, interval '1 day')::date AS night
    )
    SELECT
      n.night AS night,
      (SELECT count(*)::int FROM type_rooms) AS total,
      (SELECT count(*)::int FROM type_rooms) - (
        SELECT count(DISTINCT room_id)::int FROM (
          SELECT r.room_id
            FROM reservations r
           WHERE r.room_id IN (SELECT id FROM type_rooms)
             AND r.status = 'confirmed'
             AND r.stay @> n.night
          UNION
          SELECT b.room_id
            FROM blocks b
           WHERE b.room_id IN (SELECT id FROM type_rooms)
             AND b.period @> n.night
        ) occupied
      ) AS available
    FROM nights n
    ORDER BY n.night;
  `;

  return rows.map((row) => ({
    date: formatDateOnly(row.night),
    total: row.total,
    available: row.available,
  }));
}
