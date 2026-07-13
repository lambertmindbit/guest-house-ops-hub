import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { agentTokenOk } from "@/lib/agent-auth";
import { logMessage } from "@/lib/messaging";

// POST /api/agent/messages
//
// Token-gated seam for ROOT agents to queue outbound messages.
// Today every message lands in the outbox with status=logged — no actual
// delivery. When a provider is configured in a later phase, logMessage()
// routes to it and the status updates automatically. The agent does not need
// to change its call; only the LogAdapter implementation changes.

const schema = z.object({
  source: z.enum(["assistant", "cab", "console", "system"]),
  channel: z.enum(["whatsapp", "sms", "email", "manual"]),
  to: z.string().min(1),
  body: z.string().min(1),
  guestId: z.string().optional(),
  reservationId: z.string().optional(),
  /** Forward-compatible tenant hint; accepted, not yet persisted. */
  propertyRef: z.string().optional(),
});

async function handlePOST(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 422);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const msg = await logMessage({
    source: parsed.data.source,
    channel: parsed.data.channel,
    to: parsed.data.to,
    body: parsed.data.body,
    guestId: parsed.data.guestId,
    reservationId: parsed.data.reservationId,
  });

  // null → a de-duplicated lifecycle message (already sent for this
  // reservation+template). Free-form agent messages carry no template, so this
  // path normally always logs; treat a dedup as a benign idempotent no-op.
  if (!msg) return ok({ deduped: true }, 200);
  return ok({ id: msg.id, status: msg.status }, 201);
}

export const POST = withRoute(handlePOST);
