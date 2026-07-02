import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listVendors, createVendor } from "@/lib/vendors";

export async function GET() {
  return ok(await listVendors());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  category: z.string().trim().min(1).nullable().optional(),
  contact: z.string().trim().min(1).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createVendor(parsed.data), 201);
}
