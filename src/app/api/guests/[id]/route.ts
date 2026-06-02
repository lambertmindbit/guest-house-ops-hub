import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().nullable().optional(),
    idNumber: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    blocked: z.boolean().optional(),
    blockReason: z.string().nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.guest.findUnique({ where: { id } });
  if (!existing) return fail("guest not found", 404);

  const guest = await prisma.guest.update({ where: { id }, data: parsed.data });
  return ok(guest);
}
