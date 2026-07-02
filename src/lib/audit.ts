import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Record a sensitive action. Best-effort — callers should not let an audit
// failure break the operation (wrap with .catch(() => {})).
export async function recordAudit(action: string, entityType: string, entityId?: string | null, summary?: string | null) {
  const session = await getSession();
  return prisma.auditEvent.create({
    data: { action, entityType, entityId: entityId ?? null, summary: summary ?? null, actorUserId: session?.sub ?? null },
  });
}

export async function listAudit(limit = 200) {
  return prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

// Pure: a human-readable line for an event (testable).
export function describeAudit(e: { action: string; entityType: string; summary: string | null }): string {
  return e.summary ?? `${e.action} on ${e.entityType}`;
}
