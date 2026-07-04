import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { agentTokenOk } from "@/lib/agent-auth";

// GET /api/agent/rooms
// Read-only room catalog for the ROOT agent: the PMS truth the bot grounds its
// room cards and id mapping on (P1 of docs/ROOT-INTEGRATION-PLAN.md). Room
// CONTENT (photos, descriptions) deliberately stays ROOT-side; this returns
// identity + capacity + the base advisory rate. Date-specific pricing comes from
// GET /api/agent/quote; availability from the availability endpoints.

const schema = z.object({ propertyRef: z.string().optional() });

export async function GET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({ propertyRef: searchParams.get("propertyRef") ?? undefined });
  if (!parsed.success) return zodFail(parsed.error);

  const rooms = await prisma.room.findMany({
    where: { archivedAt: null },
    include: { roomType: true },
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
    })),
  );
}
