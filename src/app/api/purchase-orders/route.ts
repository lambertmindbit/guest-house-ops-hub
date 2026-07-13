import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { createPO } from "@/lib/vendors";

const schema = z.object({
  vendorId: z.string().min(1),
  description: z.string().trim().min(1, "describe the order"),
  amount: z.number().nonnegative(),
  status: z.enum(["draft", "ordered", "received"]).optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createPO(parsed.data), 201);
}

export const POST = withRoute(handlePOST);
