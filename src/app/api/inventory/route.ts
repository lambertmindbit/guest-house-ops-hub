import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listItems, createItem } from "@/lib/inventory";

export async function GET() {
  return ok(await listItems());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  unit: z.string().trim().min(1).nullable().optional(),
  minThreshold: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createItem(parsed.data), 201);
}
