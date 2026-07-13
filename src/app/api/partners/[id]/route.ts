import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { updatePartner, deletePartner } from "@/lib/partners";

const schema = z
  .object({
    name: z.string().trim().min(1).optional(),
    kind: z.string().trim().min(1).nullable().optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    locality: z.string().trim().min(1).nullable().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    notes: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await updatePartner(id, parsed.data);
  if (!updated) return fail("partner not found", 404);
  return ok(updated);
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deletePartner(id);
  if (!deleted) return fail("partner not found", 404);
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
