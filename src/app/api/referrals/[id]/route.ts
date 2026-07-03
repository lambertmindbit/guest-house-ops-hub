import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { updateReferral, deleteReferral } from "@/lib/partners";

const schema = z
  .object({
    status: z.enum(["referred", "booked", "declined"]).optional(),
    partnerId: z.string().trim().min(1).nullable().optional(),
    note: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await updateReferral(id, parsed.data);
  if (!updated) return fail("referral not found", 404);
  return ok(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteReferral(id);
  if (!deleted) return fail("referral not found", 404);
  return ok({ deleted: true });
}
