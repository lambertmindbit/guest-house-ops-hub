import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { listTourBookings, createTourBooking } from "@/lib/tours";

async function handleGET() {
  return ok(await listTourBookings());
}

const schema = z.object({
  tourId: z.string().min(1, "tour is required"),
  partnerId: z.string().min(1).nullable().optional(),
  guestId: z.string().min(1).nullable().optional(),
  reservationId: z.string().min(1).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  commissionPct: z.number().int().min(0).max(100).nullable().optional(),
  note: z.string().trim().min(1).nullable().optional(),
});

async function handlePOST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createTourBooking(parsed.data), 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
