import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { mergeGuests } from "@/lib/guest-merge";
import { currentRole } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

// Merge a duplicate guest INTO this one (GAP-19). Destructive (deletes the
// duplicate), so owner-only. `[id]` is the survivor; `duplicateId` is absorbed.
const schema = z.object({ duplicateId: z.string().min(1) });

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await currentRole()) !== "owner") return fail("Only the owner can merge guests.", 403);
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const result = await mergeGuests(id, parsed.data.duplicateId);
  if (!result.ok) return fail(result.error, 422);

  await recordAudit("guest.merge", "guest", id, `Merged duplicate ${parsed.data.duplicateId} into this guest`).catch(() => {});
  return ok(result);
}

export const POST = withRoute(handlePOST);
