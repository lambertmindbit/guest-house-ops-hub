import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { createVendorPayment } from "@/lib/vendors";

const schema = z.object({
  vendorId: z.string().min(1),
  amount: z.number().positive(),
  mode: z.enum(["cash", "upi", "card", "bank", "ota_collect"]).nullable().optional(),
  note: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createVendorPayment(parsed.data), 201);
}
