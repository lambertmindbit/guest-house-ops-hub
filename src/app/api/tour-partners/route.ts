import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listTourPartners, createTourPartner } from "@/lib/tours";

async function handleGET() {
  return ok(await listTourPartners());
}

const schema = z.object({
  name: z.string().trim().min(1, "name is required"),
  contact: z.string().trim().min(1).nullable().optional(),
  commissionPct: z.number().int().min(0).max(100).nullable().optional(),
});

async function handlePOST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createTourPartner(parsed.data), 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
