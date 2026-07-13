import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { dateOnly } from "@/lib/dates";
import { createTrip } from "@/lib/transport";

const schema = z.object({
  driverId: z.string().min(1).nullable().optional(),
  guestId: z.string().min(1).nullable().optional(),
  pickup: z.string().trim().min(1, "pickup is required"),
  dropoff: z.string().trim().min(1, "drop-off is required"),
  scheduledAt: dateOnly.nullable().optional(),
  fare: z.number().nonnegative().nullable().optional(),
  status: z.enum(["planned", "done", "cancelled"]).optional(),
  note: z.string().trim().min(1).nullable().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createTrip(parsed.data), 201);
}

export const POST = withRoute(handlePOST);
