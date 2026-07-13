import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { transitionRequest } from "@/lib/maintenance";

const schema = z
  .object({
    title: z.string().trim().min(1).optional(),
    status: z.enum(["open", "in_progress", "done"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    assigneeStaffId: z.string().trim().min(1).nullable().optional(),
    cost: z.number().nonnegative().nullable().optional(),
    note: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await transitionRequest(id, parsed.data);
  if (!updated) return fail("request not found", 404);
  return ok(updated);
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!existing) return fail("request not found", 404);
  await prisma.maintenanceRequest.delete({ where: { id } });
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
