import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";

const schema = z
  .object({
    name: z.string().trim().min(1).optional(),
    contact: z.string().trim().min(1).nullable().optional(),
    commissionPct: z.number().int().min(0).max(100).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const existing = await prisma.tourPartner.findUnique({ where: { id } });
  if (!existing) return fail("partner not found", 404);
  return ok(await prisma.tourPartner.update({ where: { id }, data: parsed.data }));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.tourPartner.findUnique({ where: { id } });
  if (!existing) return fail("partner not found", 404);
  await prisma.tourPartner.delete({ where: { id } });
  return ok({ deleted: true });
}
