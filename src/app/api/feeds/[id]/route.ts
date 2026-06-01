import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { syncFeed } from "@/lib/ical-import";

const patchSchema = z.object({ active: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.icalFeed.findUnique({ where: { id } });
  if (!existing) return fail("feed not found", 404);

  const feed = await prisma.icalFeed.update({ where: { id }, data: { active: parsed.data.active } });
  // Turning a feed off should drop the dates it imported.
  if (!feed.active) {
    await prisma.block.deleteMany({ where: { feedId: id, source: "ical" } });
  } else {
    await syncFeed(feed);
  }
  return ok(feed);
}

// Deleting a feed cascades to its imported blocks (FK onDelete: Cascade).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.icalFeed.findUnique({ where: { id } });
  if (!existing) return fail("feed not found", 404);
  await prisma.icalFeed.delete({ where: { id } });
  return ok({ deleted: true });
}
