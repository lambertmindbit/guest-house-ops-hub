import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { dateOnly } from "@/lib/dates";
import { getAvailability } from "@/lib/availability";
import { agentTokenOk } from "@/lib/agent-auth";

// GET /api/agent/availability?roomTypeId=&checkIn=&checkOut=
// Returns derived nightly availability for the given room type and date range.
// Read-only; wraps src/lib/availability.ts directly.

const schema = z
  .object({
    roomTypeId: z.string().min(1),
    checkIn: dateOnly,
    checkOut: dateOnly,
    propertyRef: z.string().optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    path: ["checkOut"],
    message: "checkOut must be after checkIn",
  });

export async function GET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({
    roomTypeId: searchParams.get("roomTypeId") ?? "",
    checkIn: searchParams.get("checkIn") ?? "",
    checkOut: searchParams.get("checkOut") ?? "",
    propertyRef: searchParams.get("propertyRef") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error);

  const nights = await getAvailability(
    parsed.data.roomTypeId,
    parsed.data.checkIn,
    parsed.data.checkOut,
  );
  return ok(nights);
}
