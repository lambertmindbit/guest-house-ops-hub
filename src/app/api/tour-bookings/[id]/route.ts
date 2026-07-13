import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly } from "@/lib/dates";
import { updateTourBooking, deleteTourBooking } from "@/lib/tours";

const schema = z
  .object({
    status: z.enum(["planned", "confirmed", "completed", "cancelled"]).optional(),
    guestId: z.string().min(1).nullable().optional(),
    date: dateOnly.nullable().optional(),
    amount: z.number().nonnegative().nullable().optional(),
    note: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const updated = await updateTourBooking(id, parsed.data);
  if (!updated) return fail("tour booking not found", 404);
  return ok(updated);
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteTourBooking(id);
  if (!deleted) return fail("tour booking not found", 404);
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
