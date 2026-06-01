import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api";

export async function GET() {
  const rooms = await prisma.room.findMany({
    include: { roomType: true },
    orderBy: { label: "asc" },
  });
  return ok(rooms);
}
