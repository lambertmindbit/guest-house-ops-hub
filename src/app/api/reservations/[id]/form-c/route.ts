import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

// Mark (or un-mark) the foreign-guest Form C as filed for this arrival (GAP-7).
// Audited so DPDP/FRRO accountability has a trail.
const schema = z.object({ submitted: z.boolean() });

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);

  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { guest: { select: { name: true } } } });
  if (!reservation) return fail("reservation not found", 404);

  const formCSubmittedAt = parsed.data.submitted ? new Date() : null;
  await prisma.reservation.update({ where: { id }, data: { formCSubmittedAt } });
  await recordAudit(
    parsed.data.submitted ? "form-c.submit" : "form-c.unsubmit",
    "reservation",
    id,
    `Form C ${parsed.data.submitted ? "marked filed" : "un-marked"} — ${reservation.guest.name}`,
  ).catch(() => {});

  return ok({ formCSubmittedAt });
}

export const POST = withRoute(handlePOST);
