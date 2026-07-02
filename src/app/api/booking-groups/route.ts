import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listGroups, createGroup } from "@/lib/groups";

export async function GET() {
  return ok(await listGroups());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  guestId: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createGroup(parsed.data), 201);
}
