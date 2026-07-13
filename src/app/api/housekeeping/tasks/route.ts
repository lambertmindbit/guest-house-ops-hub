import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { upsertHousekeepingTask } from "@/lib/housekeeping";

const item = z.object({ label: z.string(), done: z.boolean() });
const schema = z.object({
  roomId: z.string().min(1),
  assigneeStaffId: z.string().min(1).nullable().optional(),
  checklist: z.array(item).optional(),
  complete: z.boolean().optional(),
  completedByStaffId: z.string().min(1).nullable().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await upsertHousekeepingTask(parsed.data));
}

export const POST = withRoute(handlePOST);
