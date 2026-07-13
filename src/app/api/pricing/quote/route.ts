import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly } from "@/lib/dates";
import { quoteRoomType } from "@/lib/pricing";

// Advisory quote for the booking form. Takes a roomId (what the form has) and
// resolves its room type — pricing is per room type.
const schema = z
  .object({ roomId: z.string().min(1), checkIn: dateOnly, checkOut: dateOnly })
  .refine((d) => d.checkOut > d.checkIn, { path: ["checkOut"], message: "check-out must be after check-in" });

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({
    roomId: searchParams.get("roomId") ?? "",
    checkIn: searchParams.get("checkIn") ?? "",
    checkOut: searchParams.get("checkOut") ?? "",
  });
  if (!parsed.success) return zodFail(parsed.error);

  const room = await prisma.room.findUnique({ where: { id: parsed.data.roomId } });
  if (!room) return fail("room not found", 404);

  const quote = await quoteRoomType(room.roomTypeId, parsed.data.checkIn, parsed.data.checkOut);
  return ok(quote);
}

export const GET = withRoute(handleGET);
