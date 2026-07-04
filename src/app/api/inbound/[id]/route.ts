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

  // Don't link to a reservation that doesn't exist (or isn't this property's) —
  // the tenant extension scopes this lookup.
  if (parsed.data.reservationId) {
    const res = await prisma.reservation.findUnique({ where: { id: parsed.data.reservationId }, select: { id: true } });
    if (!res) return fail("That booking no longer exists.", 422);
  }

  const updated = await prisma.inboundBooking.update({
    where: { id },
    data: { status: parsed.data.status, reservationId: parsed.data.reservationId },
  });
  return ok(updated);
}
