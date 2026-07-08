import { prisma } from "@/lib/prisma";

// Owner-editable assistant guidance, one row per intent. The curated intent
// catalog + view types live in policy-intents.ts (client-safe, no prisma); the
// DB functions live here. Behavior that is a hard rule (e.g. cancellations are
// always human-reviewed) is NOT changeable here — these are guidance the
// assistant follows on TOP of the fixed rules, never instead.

export { POLICY_INTENTS } from "@/lib/policy-intents";
export type { PolicyIntent, PolicyView } from "@/lib/policy-intents";
import type { PolicyView } from "@/lib/policy-intents";

// All policies as a map keyed by intent, so the Settings screen can render every
// curated intent whether or not a row exists yet.
export async function listPolicies(): Promise<PolicyView[]> {
  const rows = await prisma.assistantPolicy.findMany({ orderBy: { intent: "asc" } });
  return rows.map((r) => ({ id: r.id, intent: r.intent, instructions: r.instructions, active: r.active }));
}

// Active, non-empty policies — what the agent injects.
export async function listActivePolicies(): Promise<{ intent: string; instructions: string }[]> {
  const rows = await prisma.assistantPolicy.findMany({ where: { active: true } });
  return rows
    .filter((r) => r.instructions.trim().length > 0)
    .map((r) => ({ intent: r.intent, instructions: r.instructions }));
}

// One row per intent: update if it exists, else create. (No DB unique constraint
// — a nullable tenant column makes that awkward; single-property scope is fine.)
export async function upsertPolicy(intent: string, patch: { instructions?: string; active?: boolean }) {
  const existing = await prisma.assistantPolicy.findFirst({ where: { intent } });
  if (existing) {
    return prisma.assistantPolicy.update({ where: { id: existing.id }, data: patch });
  }
  return prisma.assistantPolicy.create({
    data: { intent, instructions: patch.instructions ?? "", active: patch.active ?? true },
  });
}
