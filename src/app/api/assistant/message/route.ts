import { z } from "zod";
import { zodFail, withRoute } from "@/lib/api";
import { requestPropertyId } from "@/lib/tenant";
import { assistantStream } from "@/lib/assistant/transport";

// POST /api/assistant/message — the in-app (owner/reception) assistant transport.
// Behind the owner cookie. Streams NDJSON; owner mode → the booking flow can
// create a real reservation (demo OTP). See src/lib/assistant/transport.ts.

const schema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().max(128).optional(),
});

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  // The owner console acts on the owner's current property. Read it from the
  // x-ota-tenant header the middleware stamps from the session — NOT getSession(),
  // which reads cookies() and throws when this handler is unit-tested outside a
  // request scope. requestPropertyId() returns null there and the real header in a
  // live request.
  const propertyId = await requestPropertyId();
  return assistantStream(parsed.data.message, parsed.data.sessionId, "owner", propertyId);
}

export const POST = withRoute(handlePOST);
