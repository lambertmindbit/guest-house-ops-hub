import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";

const schema = z.object({ q: z.string().optional() });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ q: searchParams.get("q") ?? undefined });
  if (!parsed.success) return zodFail(parsed.error);
  const q = parsed.data.q?.trim();

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
        ],
      }
    : {};

  const guests = await prisma.guest.findMany({
    where,
    orderBy: { name: "asc" },
  });
  return ok(guests);
}
