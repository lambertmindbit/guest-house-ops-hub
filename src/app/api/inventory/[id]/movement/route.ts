import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { applyMovement } from "@/lib/inventory";

const schema = z.object({
  delta: z.number().int().refine((n) => n !== 0, "delta can't be zero"),
  reason: z.string().trim().min(1).nullable().optional(),
});

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const result = await applyMovement(id, parsed.data.delta, parsed.data.reason);
  if (!result.ok) {
    if (result.reason === "not_found") return fail("item not found", 404);
    return fail(`Not enough stock — only ${result.have} on hand.`, 409);
  }
  return ok(result.item);
}

export const POST = withRoute(handlePOST);
