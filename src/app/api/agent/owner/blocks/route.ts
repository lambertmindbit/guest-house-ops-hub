import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { agentTokenOk } from "@/lib/agent-auth";

// POST /api/agent/owner/blocks
// The owner console agent blocks a room (maintenance / personal use / hold).
// Owner-only, behind the agent token. Mirrors the owner /api/blocks create: a
// block is just a [startDate, endDate) marker with an optional reason — it does
// NOT touch the reservation exclusion constraint (blocks and stays coexist on
// the calendar). The tool resolves a label like "201" to the room id before
// calling this, so roomId here is always the real id.

const schema = z
  .object({
    roomId: z.string().min(1),
    startDate: dateOnly,
    endDate: dateOnly,
    reason: z.string().max(200).optional(),
  })
  .refine((d) => d.endDate > d.startDate, {
    path: ["endDate"],
    message: "end date must be after start date",
  });

async function handlePOST(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 422);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  const block = await prisma.block.create({
    data: {
      roomId: input.roomId,
      startDate: parseDateOnly(input.startDate),
      endDate: parseDateOnly(input.endDate),
      reason: input.reason,
    },
    include: { room: true },
  });

  return ok(
    {
      id: block.id,
      room: block.room.label,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: block.reason,
    },
    201,
  );
}

export const POST = withRoute(handlePOST);
