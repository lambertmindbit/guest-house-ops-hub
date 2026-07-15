import { z } from "zod";
import { fail, zodFail, withRoute } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { assistantStream } from "@/lib/assistant/transport";

// POST /api/public/assistant — the ANONYMOUS guest widget transport (no login;
// excluded from the owner cookie in middleware). Public mode: the agent can
// answer availability/prices and file a booking REQUEST for the owner to
// confirm, but can NEVER create a reservation. Guarded by:
//   • PUBLIC_CHAT_ENABLED — a kill switch; off (default) → 404 (route is dark).
//   • per-IP rate limit — blunts abuse of the (LLM-cost) endpoint.

const schema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().max(128).optional(),
  // The property whose website the widget is embedded on. Each property's site
  // sends its own id, so a shared agent answers about the right one.
  propertyId: z.string().max(128).optional(),
});

// Generous enough for a real chat, tight enough to blunt scripted abuse.
const LIMIT = 20;
const WINDOW_MS = 10 * 60 * 1000;

async function handlePOST(req: Request) {
  if (process.env.PUBLIC_CHAT_ENABLED !== "true") return fail("Not found", 404);

  const limit = rateLimit(`public-assistant:${clientIp(req)}`, LIMIT, WINDOW_MS);
  if (!limit.ok) {
    return new Response(JSON.stringify({ error: "You're sending messages a bit fast — please wait a moment." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(limit.retryAfterSec) },
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  return assistantStream(parsed.data.message, parsed.data.sessionId, "public", parsed.data.propertyId ?? null);
}

export const POST = withRoute(handlePOST);
