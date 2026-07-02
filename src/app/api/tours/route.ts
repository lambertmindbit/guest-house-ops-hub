import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listTours, createTour } from "@/lib/tours";

export async function GET() {
  return ok(await listTours());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  description: z.string().trim().min(1).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  partnerId: z.string().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createTour(parsed.data), 201);
}
