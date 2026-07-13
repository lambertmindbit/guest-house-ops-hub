import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listTours, createTour } from "@/lib/tours";

async function handleGET() {
  return ok(await listTours());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  description: z.string().trim().min(1).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  partnerId: z.string().min(1).nullable().optional(),
});

async function handlePOST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createTour(parsed.data), 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
