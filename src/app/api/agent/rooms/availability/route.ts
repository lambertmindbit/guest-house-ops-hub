import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly } from "@/lib/dates";
import { freeRooms } from "@/lib/availability";
import { agentTokenOk } from "@/lib/agent-auth";

// GET /api/agent/rooms/availability?checkIn=&checkOut=[&roomIds=a,b]
// Per-ROOM free/busy for the whole stay [checkIn, checkOut) — the ROOT agent's
// cards are per room, while /api/agent/availability is per room type. Wraps the
// same derived query the owner booking form uses (lib freeRooms), so the two
// views can never disagree. Optional roomIds narrows the answer; unknown ids are
// simply absent from the result (404-free, so a stale ROOT mapping degrades
// gracefully instead of failing the whole check).

const schema = z
  .object({
    checkIn: dateOnly,
    checkOut: dateOnly,
    roomIds: z.string().optional(), // comma-separated
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
    checkIn: searchParams.get("checkIn") ?? "",
    checkOut: searchParams.get("checkOut") ?? "",
    roomIds: searchParams.get("roomIds") ?? undefined,
    propertyRef: searchParams.get("propertyRef") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error);

  // Scope to the property the agent is asking about. Availability has no room to
  // derive from (it's asking WHICH rooms are free), so the property must come from
  // the request. With one property freeRooms falls back to the sole one; with
  // several and no propertyRef it would list all — so a property-aware agent must
  // send propertyRef, and this is the seam that honours it.
  const all = await freeRooms(parsed.data.checkIn, parsed.data.checkOut, "", parsed.data.propertyRef);
  const wanted = parsed.data.roomIds
    ? new Set(parsed.data.roomIds.split(",").map((s) => s.trim()).filter(Boolean))
    : null;
  const rows = wanted ? all.filter((r) => wanted.has(r.id)) : all;

  return ok(rows);
}

export const GET = withRoute(handleGET);
