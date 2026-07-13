import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { roomPhotosSchema, roomFacingSchema, roomViewSchema } from "@/lib/rooms";

// One PATCH serves two callers:
//  - Housekeeping: { markCleaned } stamps/clears the cleaning state.
//  - Settings admin: { label?, roomTypeId?, archived?, photos?, facing?, view? }
//    edits or retires a room. archived:true sets archived_at=now (room drops off
//    calendar/booking/etc. but keeps its history); archived:false un-archives.
const schema = z
  .object({
    markCleaned: z.boolean().optional(),
    label: z.string().trim().min(1).optional(),
    roomTypeId: z.string().min(1).optional(),
    archived: z.boolean().optional(),
    photos: roomPhotosSchema,
    facing: roomFacingSchema,
    view: roomViewSchema,
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "no fields to update",
  });

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) return fail("room not found", 404);

  const data: Record<string, unknown> = {};
  if (input.markCleaned !== undefined) {
    if (input.markCleaned) {
      data.lastCleanedAt = new Date();
      data.needsCleaningFlag = false;
    } else {
      data.needsCleaningFlag = true;
    }
  }
  if (input.label !== undefined) data.label = input.label;
  if (input.roomTypeId !== undefined) data.roomTypeId = input.roomTypeId;
  if (input.archived !== undefined) data.archivedAt = input.archived ? new Date() : null;
  if (input.photos !== undefined) data.photos = (input.photos ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull;
  if (input.facing !== undefined) data.facing = input.facing || null;
  if (input.view !== undefined) data.view = input.view || null;

  const room = await prisma.room.update({ where: { id }, data, include: { roomType: true } });
  return ok(room);
}

// Hard-delete is only allowed for a room with no history; otherwise the owner
// must archive it (the FKs are RESTRICT, and we want finance/analytics intact).
async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) return fail("room not found", 404);

  const [reservations, blocks] = await Promise.all([
    prisma.reservation.count({ where: { roomId: id } }),
    prisma.block.count({ where: { roomId: id } }),
  ]);
  if (reservations > 0 || blocks > 0) {
    return fail("Room has bookings or blocks — archive it instead of deleting.", 409);
  }

  await prisma.room.delete({ where: { id } });
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
