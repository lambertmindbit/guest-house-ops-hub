import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { listReferrals, createReferral } from "@/lib/partners";

export async function GET() {
  return ok(await listReferrals());
}

const schema = z.object({
  guestName: z.string().trim().min(1, "guestName is required"),
  partnerId: z.string().trim().min(1).nullable().optional(),
  guestPhone: z.string().trim().min(1).nullable().optional(),
  checkIn: dateOnly.nullable().optional(),
  checkOut: dateOnly.nullable().optional(),
  note: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { checkIn, checkOut, ...rest } = parsed.data;
  return ok(
    await createReferral({
      ...rest,
      checkIn: checkIn ? parseDateOnly(checkIn) : null,
      checkOut: checkOut ? parseDateOnly(checkOut) : null,
    }),
    201,
  );
}
