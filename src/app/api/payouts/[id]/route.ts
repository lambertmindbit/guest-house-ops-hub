import { prisma } from "@/lib/prisma";
import { ok, fail, withRoute } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

// Remove a mistaken payout entry (owner-only via middleware). deleteMany scopes to
// the acting property through the tenant extension, so a wrong id is a no-op miss.
async function handleDELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { count } = await prisma.payout.deleteMany({ where: { id } });
  if (count === 0) return fail("Payout not found.", 404);
  await recordAudit("payout.delete", "payout", id).catch(() => {});
  return ok({ deleted: true });
}

export const DELETE = withRoute(handleDELETE);
