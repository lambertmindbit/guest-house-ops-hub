import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { updateFaq, deleteFaq } from "@/lib/faq";

const schema = z
  .object({
    question: z.string().trim().min(1).optional(),
    answer: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).nullable().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await updateFaq(id, parsed.data);
  if (!updated) return fail("FAQ not found", 404);
  return ok(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteFaq(id);
  if (!deleted) return fail("FAQ not found", 404);
  return ok({ deleted: true });
}
