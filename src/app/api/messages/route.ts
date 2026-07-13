import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listMessages } from "@/lib/messaging";

// GET /api/messages?guestId=&reservationId=&limit=
// Owner route — lists logged outbound messages, newest first.

const schema = z.object({
  guestId: z.string().optional(),
  reservationId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({
    guestId: searchParams.get("guestId") ?? undefined,
    reservationId: searchParams.get("reservationId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error);

  const messages = await listMessages(parsed.data);
  return ok(messages);
}

export const GET = withRoute(handleGET);
