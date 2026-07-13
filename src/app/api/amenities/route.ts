import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listAmenities, createAmenity } from "@/lib/amenities";

async function handleGET() {
  return ok(await listAmenities());
}

const schema = z.object({ name: z.string().trim().min(1, "name is required") });

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createAmenity(parsed.data.name), 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
