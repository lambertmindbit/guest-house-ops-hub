import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listAmenities, createAmenity } from "@/lib/amenities";

export async function GET() {
  return ok(await listAmenities());
}

const schema = z.object({ name: z.string().trim().min(1, "name is required") });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createAmenity(parsed.data.name), 201);
}
