import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listAssets, createAsset } from "@/lib/maintenance";

async function handleGET() {
  return ok(await listAssets());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  category: z.string().trim().min(1).nullable().optional(),
  roomId: z.string().trim().min(1).nullable().optional(),
  preventiveEveryDays: z.number().int().min(1).nullable().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createAsset(parsed.data), 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
