import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listPartners, createPartner } from "@/lib/partners";

export async function GET() {
  return ok(await listPartners());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  kind: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().min(1).nullable().optional(),
  locality: z.string().trim().min(1).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createPartner(parsed.data), 201);
}
