import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";

const schema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).nullable().optional(),
    price: z.number().nonnegative().nullable().optional(),
    partnerId: z.string().min(1).nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const existing = await prisma.tour.findUnique({ where: { id } });
  if (!existing) return fail("tour not found", 404);
  return ok(await prisma.tour.update({ where: { id }, data: parsed.data }));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.tour.findUnique({ where: { id } });
  if (!existing) return fail("tour not found", 404);
  await prisma.tour.delete({ where: { id } });
  return ok({ deleted: true });
}
