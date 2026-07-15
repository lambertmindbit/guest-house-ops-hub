import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { listActivePolicies } from "@/lib/policies";
import { withTenant } from "@/lib/tenant";
import { agentTokenOk } from "@/lib/agent-auth";

// GET /api/agent/policies — the ACTIVE, non-empty owner guidance the assistant
// injects into its prompt (booking / cancellation / general). Read-only,
// token-gated. The agent applies these on top of its fixed rules — they may
// tighten behavior, never override the security/safety guardrails.

const schema = z.object({ propertyRef: z.string().optional() });

async function handleGET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({ propertyRef: searchParams.get("propertyRef") ?? undefined });
  if (!parsed.success) return zodFail(parsed.error);

  // Each property has its own assistant policies. Scope to the one the agent is
  // acting for so a shared agent applies the right property's guidance. Absent →
  // sole-property fallback.
  const propertyRef = parsed.data.propertyRef;
  return ok(await (propertyRef ? withTenant(propertyRef, listActivePolicies) : listActivePolicies()));
}

export const GET = withRoute(handleGET);
