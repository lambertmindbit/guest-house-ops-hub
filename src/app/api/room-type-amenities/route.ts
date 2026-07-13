import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { setRoomTypeAmenity } from "@/lib/amenities";

const schema = z.object({
  roomTypeId: z.string().min(1),
  amenityId: z.string().min(1),
  on: z.boolean(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { roomTypeId, amenityId, on } = parsed.data;
  await setRoomTypeAmenity(roomTypeId, amenityId, on);
  return ok({ ok: true });
}

export const POST = withRoute(handlePOST);
