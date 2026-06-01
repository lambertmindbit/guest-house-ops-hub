import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api";

export async function GET() {
  const channels = await prisma.channel.findMany({ orderBy: { name: "asc" } });
  return ok(channels);
}
