import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { dateOnly } from "@/lib/dates";
import { setAttendance } from "@/lib/staff";

const schema = z.object({
  staffId: z.string().min(1),
  date: dateOnly,
  status: z.enum(["present", "absent", "leave"]),
  note: z.string().trim().min(1).nullable().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { staffId, date, status, note } = parsed.data;
  return ok(await setAttendance(staffId, date, status, note));
}

export const POST = withRoute(handlePOST);
