import { ok, fail, withRoute } from "@/lib/api";
import { listActivePolicies } from "@/lib/policies";
import { agentTokenOk } from "@/lib/agent-auth";

// GET /api/agent/policies — the ACTIVE, non-empty owner guidance the assistant
// injects into its prompt (booking / cancellation / general). Read-only,
// token-gated. The agent applies these on top of its fixed rules — they may
// tighten behavior, never override the security/safety guardrails.

async function handleGET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);
  return ok(await listActivePolicies());
}

export const GET = withRoute(handleGET);
