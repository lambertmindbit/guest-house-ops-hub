import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listAssets, createAsset } from "@/lib/maintenance";

export async function GET() {
  return ok(await listAssets());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  category: z.string().trim().min(1).nullable().optional(),
  roomId: z.string().trim().min(1).nullable().optional(),
  preventiveEveryDays: z.number().int().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createAsset(parsed.data), 201);
}
