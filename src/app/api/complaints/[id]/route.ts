import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { transitionComplaint } from "@/lib/complaints";

const schema = z
  .object({
    status: z.enum(["open", "in_progress", "resolved"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    assignee: z.string().trim().min(1).nullable().optional(),
    resolutionNote: z.string().trim().min(1).nullable().optional(),
    satisfaction: z.number().int().min(1).max(5).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await transitionComplaint(id, parsed.data);
  if (!updated) return fail("complaint not found", 404);
  return ok(updated);
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.complaint.findUnique({ where: { id } });
  if (!existing) return fail("complaint not found", 404);
  await prisma.complaint.delete({ where: { id } });
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
