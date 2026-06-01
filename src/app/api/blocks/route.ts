import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";

const createSchema = z
  .object({
    roomId: z.string().min(1),
    startDate: dateOnly,
    endDate: dateOnly,
    reason: z.string().optional(),
  })
  .refine((d) => d.endDate > d.startDate, {
    path: ["endDate"],
    message: "end date must be after start date",
  });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  const block = await prisma.block.create({
    data: {
      roomId: input.roomId,
      startDate: parseDateOnly(input.startDate),
      endDate: parseDateOnly(input.endDate),
      reason: input.reason,
    },
    include: { room: { include: { roomType: true } } },
  });
  return ok(block, 201);
}

const listSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = listSchema.safeParse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error);
  const { from, to } = parsed.data;

  const where =
    from && to
      ? {
          startDate: { lt: parseDateOnly(to) },
          endDate: { gt: parseDateOnly(from) },
        }
      : {};

  const blocks = await prisma.block.findMany({
    where,
    include: { room: { include: { roomType: true } } },
    orderBy: { startDate: "asc" },
  });
  return ok(blocks);
}
