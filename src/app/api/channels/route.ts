import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";

export async function GET() {
  const channels = await prisma.channel.findMany({
    include: { _count: { select: { reservations: true } } },
    orderBy: { name: "asc" },
  });
  return ok(channels);
}

const createSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  commissionPct: z.number().min(0).max(100),
  collectsPayment: z.boolean(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const channel = await prisma.channel.create({ data: parsed.data });
  return ok(channel, 201);
}
