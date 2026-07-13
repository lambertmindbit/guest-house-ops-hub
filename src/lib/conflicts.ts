import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/dates";
import { requestPropertyId } from "@/lib/tenant";

// Just the number, for the "Needs you" nav badge — which renders on EVERY page.
// getConflicts() materialises full rows and joins guests + rooms to render the
// list; the badge needs none of that. Same tenant scoping, same overlap rule.
export async function countConflicts(propertyId?: string | null): Promise<number> {
  const pid = await requestPropertyId(propertyId);
  const rows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
      FROM reservations r
      JOIN blocks b ON b.room_id = r.room_id AND r.stay && b.period
     WHERE r.status = 'confirmed'
       AND (${pid}::text IS NULL OR r.property_id = ${pid});
  `;
  return rows[0]?.n ?? 0;
}

export type Conflict = {
  reservationId: string;
  guestName: string;
  roomLabel: string;
  reservationStart: string;
  reservationEnd: string;
  blockReason: string | null;
  blockSource: string;
  overlapStart: string;
  overlapEnd: string;
};

// A conflict is a room that is BOTH confirmed-reserved and blocked over the same
// nights. The DB already prevents two confirmed stays from overlapping, so this
// is the realistic clash — e.g. an imported OTA date landing on top of a direct
// booking. We find them with the daterange overlap (&&) and intersection (*).
export async function getConflicts(propertyId?: string | null): Promise<Conflict[]> {
  const pid = await requestPropertyId(propertyId);
  const rows = await prisma.$queryRaw<
    {
      reservation_id: string;
      guest_name: string;
      room_label: string;
      res_start: Date;
      res_end: Date;
      block_reason: string | null;
      block_source: string;
      ov_start: Date;
      ov_end: Date;
    }[]
  >`
    SELECT
      r.id            AS reservation_id,
      g.name          AS guest_name,
      rm.label        AS room_label,
      lower(r.stay)   AS res_start,
      upper(r.stay)   AS res_end,
      b.reason        AS block_reason,
      b.source::text  AS block_source,
      lower(r.stay * b.period) AS ov_start,
      upper(r.stay * b.period) AS ov_end
    FROM reservations r
    JOIN blocks b  ON b.room_id = r.room_id AND r.stay && b.period
    JOIN guests g  ON g.id = r.guest_id
    JOIN rooms rm  ON rm.id = r.room_id
    WHERE r.status = 'confirmed'
      -- Tenant scope: filter to the acting property, or all when unscoped (null).
      AND (${pid}::text IS NULL OR r.property_id = ${pid})
    ORDER BY ov_start;
  `;

  return rows.map((row) => ({
    reservationId: row.reservation_id,
    guestName: row.guest_name,
    roomLabel: row.room_label,
    reservationStart: formatDateOnly(row.res_start),
    reservationEnd: formatDateOnly(row.res_end),
    blockReason: row.block_reason,
    blockSource: row.block_source,
    overlapStart: formatDateOnly(row.ov_start),
    overlapEnd: formatDateOnly(row.ov_end),
  }));
}
