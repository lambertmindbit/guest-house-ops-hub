import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { updateReview } from "@/lib/reviews";

const schema = z
  .object({
    status: z.enum(["pending", "sent", "received", "responded"]).optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    responseDraft: z.string().trim().min(1).nullable().optional(),
    link: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await updateReview(id, parsed.data);
  if (!updated) return fail("review not found", 404);
  return ok(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.reviewRequest.findUnique({ where: { id } });
  if (!existing) return fail("review not found", 404);
  await prisma.reviewRequest.delete({ where: { id } });
  return ok({ deleted: true });
}
