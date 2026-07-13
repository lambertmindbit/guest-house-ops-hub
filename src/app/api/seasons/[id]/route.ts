import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";

const updateSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    startDate: dateOnly,
    endDate: dateOnly,
    adjustPct: z.number().min(-100).max(500),
  })
  .refine((d) => d.endDate >= d.startDate, { path: ["endDate"], message: "end must be on/after start" });

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.season.findUnique({ where: { id } });
  if (!existing) return fail("season not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { name, startDate, endDate, adjustPct } = parsed.data;

  const season = await prisma.season.update({
    where: { id },
    data: { name, startDate: parseDateOnly(startDate), endDate: parseDateOnly(endDate), adjustPct },
  });
  return ok(season);
}

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.season.findUnique({ where: { id } });
  if (!existing) return fail("season not found", 404);

  await prisma.season.delete({ where: { id } });
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
