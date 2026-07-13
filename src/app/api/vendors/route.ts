import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listVendors, createVendor } from "@/lib/vendors";

async function handleGET() {
  return ok(await listVendors());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  category: z.string().trim().min(1).nullable().optional(),
  contact: z.string().trim().min(1).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createVendor(parsed.data), 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
