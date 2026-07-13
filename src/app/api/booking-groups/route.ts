import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listGroups, createGroup } from "@/lib/groups";

async function handleGET() {
  return ok(await listGroups());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  guestId: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createGroup(parsed.data), 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
