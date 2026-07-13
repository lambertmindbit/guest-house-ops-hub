import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listRequests, createRequest } from "@/lib/maintenance";

const STATUS = z.enum(["open", "in_progress", "done"]);

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = STATUS.safeParse(searchParams.get("status") ?? undefined);
  return ok(await listRequests(status.success ? status.data : undefined));
}

const schema = z.object({
  title: z.string().trim().min(1, "describe the issue"),
  description: z.string().trim().min(1).nullable().optional(),
  assetId: z.string().trim().min(1).nullable().optional(),
  roomId: z.string().trim().min(1).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assigneeStaffId: z.string().trim().min(1).nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createRequest(parsed.data), 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
