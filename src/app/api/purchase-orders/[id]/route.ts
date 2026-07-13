import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { updatePO } from "@/lib/vendors";

const schema = z
  .object({
    description: z.string().trim().min(1).optional(),
    amount: z.number().nonnegative().optional(),
    status: z.enum(["draft", "ordered", "received"]).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await updatePO(id, parsed.data);
  if (!updated) return fail("purchase order not found", 404);
  return ok(updated);
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) return fail("purchase order not found", 404);
  await prisma.purchaseOrder.delete({ where: { id } });
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
