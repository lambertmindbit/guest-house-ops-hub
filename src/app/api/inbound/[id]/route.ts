import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";

// Update a staged inbound booking's status after review:
//   imported  — the owner created the real reservation (we link its id)
//   dismissed — spam / duplicate / not a booking
const schema = z.object({
  status: z.enum(["imported", "dismissed"]),
  reservationId: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.inboundBooking.findUnique({ where: { id } });
  if (!existing) return fail("inbound booking not found", 404);

  const updated = await prisma.inboundBooking.update({
    where: { id },
    data: { status: parsed.data.status, reservationId: parsed.data.reservationId },
  });
  return ok(updated);
}
