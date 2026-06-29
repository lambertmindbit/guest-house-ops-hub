import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { createEscalation } from "@/lib/escalations";

// POST /api/agent/escalations
//
// The seam the ROOT AI agents (Assistant / Cab / Console) call to file a
// human-in-the-loop escalation. This is the agent equivalent of the OTA
// `POST /api/ingest/email` webhook:
//
//   • It is NOT behind the owner session cookie — it carries its own shared
//     secret (`AGENT_TOKEN`). It must therefore be added to the middleware
//     matcher's exclude list (see INTEGRATION.md).
//   • Sensitive actions are never performed by the agent. It only *files* a
//     request; a human acts from the queue. This is the deterministic core's
//     half of the HITL contract.
//   • Supply a stable `externalId` (e.g. agent conversation id + event seq) for
//     safe retries — duplicates are de-duped, not re-created.

function tokenOk(req: Request): boolean {
  const expected = process.env.AGENT_TOKEN;
  if (!expected) return false; // fail closed if unconfigured
  const header =
    req.headers.get("x-agent-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  // constant-time-ish compare; lengths differ rarely, fine for a shared secret
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

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
  /** Forward-compatible tenant hint; accepted now, persisted post-tenancy. */
  propertyRef: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  if (!tokenOk(req)) return fail("Unauthorized", 401);

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
    propertyRef: d.propertyRef,
  });

  // 200 on a de-dupe hit (idempotent), 201 on a fresh create.
  return ok({ id: escalation.id, status: escalation.status, deduped }, deduped ? 200 : 201);
}
