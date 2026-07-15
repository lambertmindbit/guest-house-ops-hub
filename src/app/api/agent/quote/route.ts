import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { quoteRoomType } from "@/lib/pricing";
import { withTenant } from "@/lib/tenant";
import { agentTokenOk } from "@/lib/agent-auth";

// GET /api/agent/quote?roomId=&checkIn=&checkOut=
// Returns an advisory price quote for the given room and date range.
// Accepts roomId (same as the owner booking form) and resolves the room type.
// Advisory only — never pushed to OTAs, never rewrites a saved booking.

const schema = z
  .object({
    roomId: z.string().min(1),
    checkIn: dateOnly,
    checkOut: dateOnly,
    propertyRef: z.string().optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    path: ["checkOut"],
    message: "checkOut must be after checkIn",
  });

async function handleGET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({
    roomId: searchParams.get("roomId") ?? "",
    checkIn: searchParams.get("checkIn") ?? "",
    checkOut: searchParams.get("checkOut") ?? "",
    propertyRef: searchParams.get("propertyRef") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error);

  const room = await prisma.room.findUnique({ where: { id: parsed.data.roomId } });
  if (!room) return fail("Room not found", 404);

  // Price under the ROOM's property, derived from the room rather than trusting the
  // agent's propertyRef. Pricing reads that property's rules, seasons and floor/
  // ceiling (all property-scoped) — without this, a quote on a two-property client
  // would apply whichever property's pricing came first.
  const priceIt = () => quoteRoomType(room.roomTypeId, parsed.data.checkIn, parsed.data.checkOut);
  const quote = await (room.propertyId ? withTenant(room.propertyId, priceIt) : priceIt());
  return ok(quote);
}

export const GET = withRoute(handleGET);
