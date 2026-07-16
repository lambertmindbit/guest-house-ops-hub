import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail, withRoute } from "@/lib/api";

async function handleGET() {
  const agents = await prisma.agent.findMany({
    include: { _count: { select: { reservations: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return ok(agents);
}

const createSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  phone: z.string().trim().min(1).optional(),
  commissionPct: z.number().min(0).max(100),
  notes: z.string().trim().min(1).optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const agent = await prisma.agent.create({ data: parsed.data });
  return ok(agent, 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
