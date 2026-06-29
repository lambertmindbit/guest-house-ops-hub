import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { getEscalation, transitionEscalation } from "@/lib/escalations";

// GET   /api/escalations/[id] — fetch one (owner cookie)
// PATCH /api/escalations/[id] — triage: change status / severity / assignee /
//                               resolution note. Owner cookie.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const e = await getEscalation(id);
  if (!e) return fail("Escalation not found", 404);
  return ok(e);
}

const PatchBody = z
  .object({
    status: z.enum(["open", "in_progress", "resolved", "dismissed"]).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    assignedTo: z.string().max(160).nullable().optional(),
    resolutionNote: z.string().max(4000).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "No changes supplied" });

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 422);
  }
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const updated = await transitionEscalation(id, parsed.data);
  if (!updated) return fail("Escalation not found", 404);
  return ok(updated);
}
