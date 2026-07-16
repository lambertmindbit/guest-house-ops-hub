import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    commissionPct: z.number().min(0).max(100).optional(),
    notes: z.string().trim().min(1).nullable().optional(),
    active: z.boolean().optional(),
    // Mark (or clear) verification. `true` stamps now; `false` clears it.
    verified: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "no fields to update",
  });

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.agent.findUnique({ where: { id } });
  if (!existing) return fail("agent not found", 404);

  const { verified, ...rest } = parsed.data;
  const data =
    verified === undefined
      ? rest
      : { ...rest, verifiedAt: verified ? new Date() : null };

  const agent = await prisma.agent.update({ where: { id }, data });
  return ok(agent);
}

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.agent.findUnique({ where: { id } });
  if (!existing) return fail("agent not found", 404);

  // An agent with bookings is history you can't erase without orphaning the
  // commission record — deactivate instead (mirrors the Channel delete guard).
  const bookings = await prisma.reservation.count({ where: { agentId: id } });
  if (bookings > 0)
    return fail("This agent has bookings — deactivate them instead of deleting.", 409);

  await prisma.agent.delete({ where: { id } });
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
