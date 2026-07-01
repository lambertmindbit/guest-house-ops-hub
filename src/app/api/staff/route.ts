import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listStaff, createStaff } from "@/lib/staff";

export async function GET() {
  return ok(await listStaff());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  role: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createStaff(parsed.data), 201);
}
