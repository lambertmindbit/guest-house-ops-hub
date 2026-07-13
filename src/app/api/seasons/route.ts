import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail, withRoute } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";

async function handleGET() {
  const seasons = await prisma.season.findMany({ orderBy: { startDate: "asc" } });
  return ok(seasons);
}

const createSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    startDate: dateOnly,
    endDate: dateOnly,
    adjustPct: z.number().min(-100).max(500),
  })
  .refine((d) => d.endDate >= d.startDate, { path: ["endDate"], message: "end must be on/after start" });

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { name, startDate, endDate, adjustPct } = parsed.data;

  const season = await prisma.season.create({
    data: { name, startDate: parseDateOnly(startDate), endDate: parseDateOnly(endDate), adjustPct },
  });
  return ok(season, 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
