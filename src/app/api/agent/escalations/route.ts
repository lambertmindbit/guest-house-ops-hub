import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { createEscalation } from "@/lib/escalations";
import { agentTokenOk } from "@/lib/agent-auth";

// POST /api/agent/escalations — token-gated agent seam (see agent-auth.ts).
// Supply a stable `externalId` for safe retries — duplicates are de-duped.

const AgentBody = z.object({
  source: z.enum(["assistant", "cab", "console"]),
  category: z
    .enum(["customer", "driver", "booking", "payment", "maintenance", "other"])
    .default("other"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(4000),
  reason: z.string().max(2000).optional(),
  raisedBy: z
    .object({
      name: z.string().max(160).optional(),
      contact: z.string().max(160).optional(),
      lang: z.string().max(16).optional(), // "kha" | "hi" | "en" | …
    })
    .optional(),
  originalText: z.string().max(8000).optional(),
  translatedText: z.string().max(8000).optional(),
  related: z
    .object({
      type: z.enum(["reservation", "guest", "trip"]),
      id: z.string().max(64),
    })
    .optional(),
  threadRef: z.string().max(128).optional(),
  externalId: z.string().max(128).optional(),
  // Structured payload for a direct owner action (e.g. "Approve & book" on a
  // booking request) — see the schema comment on Escalation.metadata.
  metadata: z
    .object({
      kind: z.string().max(40).optional(),
      roomId: z.string().max(64).optional(),
      roomLabel: z.string().max(64).optional(),
      roomTypeName: z.string().max(120).optional(),
      checkIn: z.string().max(20).optional(),
      checkOut: z.string().max(20).optional(),
      nights: z.number().optional(),
      total: z.number().optional(),
      guestName: z.string().max(160).optional(),
      guestPhone: z.string().max(32).optional(),
    })
    .optional(),
  /** Forward-compatible tenant hint; accepted now, persisted post-tenancy. */
  propertyRef: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 422);
  }
  const parsed = AgentBody.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const d = parsed.data;
  const { escalation, deduped } = await createEscalation({
    source: d.source,
    category: d.category,
    severity: d.severity,
    title: d.title,
    summary: d.summary,
    reason: d.reason,
    raisedByName: d.raisedBy?.name,
    raisedByContact: d.raisedBy?.contact,
    raisedByLang: d.raisedBy?.lang,
    originalText: d.originalText,
    translatedText: d.translatedText,
    relatedType: d.related?.type,
    relatedId: d.related?.id,
    threadRef: d.threadRef,
    externalId: d.externalId,
    metadata: d.metadata,
    propertyRef: d.propertyRef,
  });

  // 200 on a de-dupe hit (idempotent), 201 on a fresh create.
  return ok({ id: escalation.id, status: escalation.status, deduped }, deduped ? 200 : 201);
}
