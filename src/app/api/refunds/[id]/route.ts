import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

// Owner transitions a refund. Approving / marking partial stamps approvedAt;
// rejecting clears it. Amount can be adjusted (e.g. a partial refund).
const schema = z
  .object({
    status: z.enum(["approved", "partial", "rejected"]).optional(),
    amount: z.number().nonnegative().optional(),
    reason: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.refund.findUnique({ where: { id } });
  if (!existing) return fail("refund not found", 404);

  const approvedAt =
    parsed.data.status === "approved" || parsed.data.status === "partial"
      ? new Date()
      : parsed.data.status === "rejected"
      ? null
      : undefined;

  const refund = await prisma.refund.update({
    where: { id },
    data: { ...parsed.data, ...(approvedAt !== undefined ? { approvedAt } : {}) },
  });
  if (parsed.data.status) await recordAudit(`refund.${parsed.data.status}`, "refund", id).catch(() => {});
  return ok(refund);
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.refund.findUnique({ where: { id } });
  if (!existing) return fail("refund not found", 404);
  await prisma.refund.delete({ where: { id } });
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
