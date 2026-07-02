import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { transitionPO } from "@/lib/vendors";

const schema = z.object({ status: z.enum(["draft", "ordered", "received"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await transitionPO(id, parsed.data.status);
  if (!updated) return fail("purchase order not found", 404);
  return ok(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) return fail("purchase order not found", 404);
  await prisma.purchaseOrder.delete({ where: { id } });
  return ok({ deleted: true });
}
