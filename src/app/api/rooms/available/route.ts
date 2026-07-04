import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { dateOnly } from "@/lib/dates";
import { freeRooms } from "@/lib/availability";

// Which physical rooms are free for the whole stay [checkIn, checkOut)?
// Powers the reservation form's room chips so an overlapping room can't be
// picked. Wraps the single room-level availability query in lib/availability
// (shared with the agent seam); `exclude` lets edit-mode ignore the reservation
// being edited.
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
  const rows = await freeRooms(checkIn, checkOut, exclude);
  // Shape unchanged from before the lib extraction (roomTypeId added harmlessly).
  return ok(rows);
}
