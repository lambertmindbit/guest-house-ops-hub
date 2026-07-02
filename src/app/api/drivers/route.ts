import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listDrivers, createDriver } from "@/lib/transport";

export async function GET() {
  return ok(await listDrivers());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  phone: z.string().trim().min(1).nullable().optional(),
  vehicleNumber: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createDriver(parsed.data), 201);
}
