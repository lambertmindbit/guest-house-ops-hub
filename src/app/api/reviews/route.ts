import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listReviews, createReview } from "@/lib/reviews";

async function handleGET() {
  return ok(await listReviews());
}

const schema = z.object({
  channel: z.string().trim().min(1).optional(),
  link: z.string().trim().min(1).nullable().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createReview(parsed.data), 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
