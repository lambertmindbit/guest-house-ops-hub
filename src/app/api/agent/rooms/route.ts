import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { agentTokenOk } from "@/lib/agent-auth";

// GET /api/agent/rooms
// Read-only room catalog for the ROOT agent: the PMS truth the bot grounds its
// room cards and id mapping on (P1 of docs/ROOT-INTEGRATION-PLAN.md). Returns
// identity + capacity + the base advisory rate, plus owner-authored guest-facing
// content (photos, facing, view, room-type amenities) so the assistant can show
// a photo card and answer "does it face east / is it poolside / what's included".
// Date-specific pricing comes from GET /api/agent/quote; availability from the
// availability endpoints.

const schema = z.object({ propertyRef: z.string().optional() });

async function handleGET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({ propertyRef: searchParams.get("propertyRef") ?? undefined });
  if (!parsed.success) return zodFail(parsed.error);

  const rooms = await prisma.room.findMany({
    where: { archivedAt: null },
    include: { roomType: { include: { amenities: { include: { amenity: true } } } } },
    orderBy: [{ roomType: { name: "asc" } }, { label: "asc" }],
  });

  return ok(
    rooms.map((r) => ({
      id: r.id,
      label: r.label,
      roomTypeId: r.roomTypeId,
      roomTypeName: r.roomType.name,
      maxOccupancy: r.roomType.maxOccupancy,
      baseRate: Number(r.roomType.baseRate),
      photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
      facing: r.facing,
      view: r.view,
      amenities: r.roomType.amenities.map((a) => a.amenity.name),
    })),
  );
}

export const GET = withRoute(handleGET);
