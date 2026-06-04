import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";
import { dateOnly } from "@/lib/dates";

// Which physical rooms are free for the whole stay [checkIn, checkOut)?
// Powers the reservation form's room chips so an overlapping room can't be
// picked. Availability stays derived (no stored counter): a room is free when
// no confirmed reservation and no block overlaps the half-open range. `exclude`
// lets edit-mode ignore the reservation being edited.
const schema = z
  .object({
    checkIn: dateOnly,
    checkOut: dateOnly,
    exclude: z.string().optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    path: ["checkOut"],
    message: "`checkOut` must be after `checkIn`",
  });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({
    checkIn: searchParams.get("checkIn") ?? undefined,
    checkOut: searchParams.get("checkOut") ?? undefined,
    exclude: searchParams.get("exclude") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error);

  const { checkIn, checkOut, exclude = "" } = parsed.data;

  const rows = await prisma.$queryRaw<
    { id: string; label: string; roomTypeName: string; free: boolean }[]
  >`
    WITH rng AS (SELECT daterange(${checkIn}::date, ${checkOut}::date, '[)') AS r)
    SELECT rm.id,
           rm.label,
           rt.name AS "roomTypeName",
           NOT EXISTS (
             SELECT 1 FROM reservations res, rng
              WHERE res.room_id = rm.id
                AND res.status = 'confirmed'
                AND res.id <> ${exclude}
                AND res.stay && rng.r
           )
           AND NOT EXISTS (
             SELECT 1 FROM blocks b, rng
              WHERE b.room_id = rm.id
                AND b.period && rng.r
           ) AS free
      FROM rooms rm
      JOIN room_types rt ON rt.id = rm.room_type_id
     WHERE rm.archived_at IS NULL
     ORDER BY rt.name, rm.label;
  `;

  return ok(rows);
}
