import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import {
  listEscalations,
  createEscalation,
  type EscalationListFilters,
} from "@/lib/escalations";

// GET /api/escalations  — list for the queue (owner cookie, via middleware)
// POST /api/escalations — owner creates one by hand
//
// The agent's entry point is the separate token-gated POST /api/agent/escalations.

const Status = z.enum(["open", "in_progress", "resolved", "dismissed"]);
const Category = z.enum([
  "customer",
  "driver",
  "booking",
  "payment",
  "maintenance",
  "other",
]);
const Severity = z.enum(["low", "medium", "high", "critical"]);
const RelatedType = z.enum(["reservation", "guest", "trip", "none"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parse = z
    .object({
      status: Status.optional(),
      category: Category.optional(),
      severity: Severity.optional(),
      since: z.string().datetime().optional(),
    })
    .safeParse({
      status: url.searchParams.get("status") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      severity: url.searchParams.get("severity") ?? undefined,
      since: url.searchParams.get("since") ?? undefined,
    });
  if (!parse.success) return zodFail(parse.error);

  const filters: EscalationListFilters = {
    status: parse.data.status,
    category: parse.data.category,
    severity: parse.data.severity,
    since: parse.data.since ? new Date(parse.data.since) : undefined,
  };
  return ok(await listEscalations(filters));
}

const CreateBody = z.object({
  category: Category.default("other"),
  severity: Severity.default("medium"),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(4000),
  reason: z.string().max(2000).optional(),
  raisedByName: z.string().max(160).optional(),
  raisedByContact: z.string().max(160).optional(),
  relatedType: RelatedType.default("none"),
  relatedId: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 422);
  }
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const { escalation } = await createEscalation({
    source: "manual",
    ...parsed.data,
  });
  return ok(escalation, 201);
}
