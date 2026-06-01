import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";

// markCleaned: true  -> stamp lastCleanedAt now (clears the cleaning task)
// markCleaned: false -> clear it (flag the room as needing cleaning again)
const schema = z.object({ markCleaned: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) return fail("room not found", 404);

  const room = await prisma.room.update({
    where: { id },
    data: { lastCleanedAt: parsed.data.markCleaned ? new Date() : null },
  });
  return ok(room);
}
