import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";

// Arrival/departure stamps for a confirmed booking. These don't touch `status`
// or `stay`, so the no-double-booking exclusion constraint is unaffected.
//   checkin  -> stamp arrival
//   checkout -> stamp departure (and arrival too, if it was skipped)
//   undo     -> step back one stage (clear departure, else clear arrival)
const schema = z.object({ action: z.enum(["checkin", "checkout", "undo"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) return fail("reservation not found", 404);
  if (existing.status !== "confirmed") {
    return fail("Only confirmed bookings can be checked in or out.", 409);
  }

  const now = new Date();
  let data: { checkedInAt?: Date | null; checkedOutAt?: Date | null };
  switch (parsed.data.action) {
    case "checkin":
      data = { checkedInAt: now };
      break;
    case "checkout":
      data = { checkedOutAt: now, checkedInAt: existing.checkedInAt ?? now };
      break;
    case "undo":
      data = existing.checkedOutAt ? { checkedOutAt: null } : { checkedInAt: null };
      break;
  }

  const reservation = await prisma.reservation.update({ where: { id }, data });
  return ok(reservation);
}
