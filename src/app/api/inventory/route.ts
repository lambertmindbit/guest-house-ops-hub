import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listItems, createItem } from "@/lib/inventory";

async function handleGET() {
  return ok(await listItems());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  unit: z.string().trim().min(1).nullable().optional(),
  minThreshold: z.number().int().min(0).optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createItem(parsed.data), 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
