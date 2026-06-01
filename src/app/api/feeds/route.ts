import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";

export async function GET() {
  const feeds = await prisma.icalFeed.findMany({
    include: { room: true },
    orderBy: { createdAt: "desc" },
  });
  return ok(feeds);
}

const createSchema = z.object({
  roomId: z.string().min(1),
  label: z.string().min(1),
  url: z.string().url(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const feed = await prisma.icalFeed.create({ data: parsed.data, include: { room: true } });
  return ok(feed, 201);
}
