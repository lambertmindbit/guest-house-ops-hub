import { ok, fail } from "@/lib/api";
import { agentTokenOk } from "@/lib/agent-auth";
import { listEscalations } from "@/lib/escalations";

// GET /api/agent/owner/escalations
// The owner's open human-in-the-loop queue: booking requests, complaints and
// anything an agent handed off. Returns open + in-progress items only (the ones
// still needing the owner), flattened to what the console agent speaks from.
// Owner-only, behind the agent token.

export async function GET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  const [open, inProgress] = await Promise.all([
    listEscalations({ status: "open" }),
    listEscalations({ status: "in_progress" }),
  ]);

  const items = [...open, ...inProgress].map((e) => ({
    id: e.id,
    status: e.status,
    category: e.category,
    severity: e.severity,
    title: e.title,
    summary: e.summary,
    raisedBy: e.raisedByName ?? null,
    contact: e.raisedByContact ?? null,
    createdAt: e.createdAt,
  }));

  return ok({ count: items.length, items });
}
