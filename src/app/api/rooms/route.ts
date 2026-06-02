import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";

// By default we hide archived rooms (calendar, booking picker, etc.).
// Settings passes ?includeArchived=1 so the owner can see and un-archive them.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "1";
  const rooms = await prisma.room.findMany({
    where: includeArchived ? undefined : { archivedAt: null },
    include: { roomType: true },
    orderBy: { label: "asc" },
  });
  return ok(rooms);
}

const createSchema = z.object({
  roomTypeId: z.string().min(1),
  label: z.string().trim().min(1, "label is required"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const room = await prisma.room.create({
    data: parsed.data,
    include: { roomType: true },
  });
  return ok(room, 201);
}
