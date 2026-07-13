import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";

const schema = z
  .object({
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    vehicleNumber: z.string().trim().min(1).nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const existing = await prisma.driver.findUnique({ where: { id } });
  if (!existing) return fail("driver not found", 404);
  return ok(await prisma.driver.update({ where: { id }, data: parsed.data }));
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.driver.findUnique({ where: { id } });
  if (!existing) return fail("driver not found", 404);
  await prisma.driver.delete({ where: { id } });
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
