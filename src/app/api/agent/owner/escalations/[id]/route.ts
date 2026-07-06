import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { agentTokenOk } from "@/lib/agent-auth";
import { transitionEscalation } from "@/lib/escalations";

// POST /api/agent/owner/escalations/[id]
// The owner console agent acts on a queue item: resolve, dismiss, or start it,
// with an optional note. Owner-only, behind the agent token. Reuses
// transitionEscalation (same status/resolvedAt bookkeeping as the owner PATCH).

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(["in_progress", "resolved", "dismissed"]),
  resolutionNote: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: Ctx) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 422);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const updated = await transitionEscalation(id, parsed.data);
  if (!updated) return fail("Request not found", 404);
  return ok({ id: updated.id, status: updated.status, title: updated.title });
}
