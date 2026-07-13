import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { updateVendorPayment, deleteVendorPayment } from "@/lib/vendors";

const schema = z
  .object({
    amount: z.number().nonnegative().optional(),
    note: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await updateVendorPayment(id, parsed.data);
  if (!updated) return fail("payment not found", 404);
  return ok(updated);
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteVendorPayment(id);
  if (!deleted) return fail("payment not found", 404);
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
