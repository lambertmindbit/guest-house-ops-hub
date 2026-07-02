import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { setTourBookingStatus } from "@/lib/tours";

const schema = z.object({ status: z.enum(["planned", "confirmed", "completed", "cancelled"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await setTourBookingStatus(id, parsed.data.status);
  if (!updated) return fail("tour booking not found", 404);
  return ok(updated);
}
