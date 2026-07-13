import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { createComplaint, listComplaints } from "@/lib/complaints";

const CATEGORY = z.enum(["maintenance", "cleanliness", "food", "noise", "staff", "billing", "other"]);
const PRIORITY = z.enum(["low", "medium", "high"]);
const STATUS = z.enum(["open", "in_progress", "resolved"]);

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = STATUS.safeParse(searchParams.get("status") ?? undefined);
  const category = CATEGORY.safeParse(searchParams.get("category") ?? undefined);
  const rows = await listComplaints({
    status: status.success ? status.data : undefined,
    category: category.success ? category.data : undefined,
  });
  return ok(rows);
}

const createSchema = z.object({
  description: z.string().trim().min(1, "describe the issue"),
  category: CATEGORY.optional(),
  priority: PRIORITY.optional(),
  assignee: z.string().trim().min(1).nullable().optional(),
  guestId: z.string().trim().min(1).nullable().optional(),
  reservationId: z.string().trim().min(1).nullable().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const complaint = await createComplaint(parsed.data);
  return ok(complaint, 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
