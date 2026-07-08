import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listPolicies, upsertPolicy, POLICY_INTENTS } from "@/lib/policies";

// GET  /api/policies — all assistant policies (owner Settings screen).
// POST /api/policies — upsert one intent's instructions / active flag.
// Owner-gated by the edge middleware, like the other /api/* app routes.

export async function GET() {
  return ok(await listPolicies());
}

const INTENTS = POLICY_INTENTS.map((p) => p.intent) as [string, ...string[]];

const schema = z.object({
  intent: z.enum(INTENTS),
  instructions: z.string().max(4000).optional(),
  active: z.boolean().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { intent, ...patch } = parsed.data;
  const row = await upsertPolicy(intent, patch);
  return ok({ id: row.id, intent: row.intent, instructions: row.instructions, active: row.active });
}
