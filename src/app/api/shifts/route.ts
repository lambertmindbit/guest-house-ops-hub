import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { dateOnly } from "@/lib/dates";
import { createShift } from "@/lib/staff";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const schema = z.object({
  staffId: z.string().min(1),
  date: dateOnly,
  start: z.string().regex(HHMM, "use HH:MM"),
  end: z.string().regex(HHMM, "use HH:MM"),
  note: z.string().trim().min(1).nullable().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createShift(parsed.data), 201);
}

export const POST = withRoute(handlePOST);
