import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { serviceAsset } from "@/lib/maintenance";

const schema = z
  .object({
    name: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).nullable().optional(),
    roomId: z.string().trim().min(1).nullable().optional(),
    preventiveEveryDays: z.number().int().min(1).nullable().optional(),
    service: z.boolean().optional(), // mark serviced today
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return fail("asset not found", 404);

  const { service, ...fields } = parsed.data;
  if (service) return ok(await serviceAsset(id));
  return ok(await prisma.asset.update({ where: { id }, data: fields }));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return fail("asset not found", 404);
  await prisma.asset.delete({ where: { id } });
  return ok({ deleted: true });
}
