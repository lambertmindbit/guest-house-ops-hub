import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { setReservationGroup } from "@/lib/groups";

// Attach (or detach) an existing reservation to this group. The reservation was
// created through the guarded path already — this only sets its group link.
const schema = z.object({
  reservationId: z.string().min(1),
  attach: z.boolean(),
});

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await setReservationGroup(parsed.data.reservationId, parsed.data.attach ? id : null));
}

export const POST = withRoute(handlePOST);
