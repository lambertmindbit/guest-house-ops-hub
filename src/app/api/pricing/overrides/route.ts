import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail, withRoute } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { recordAudit } from "@/lib/audit";

// Pin or clear a manual nightly rate for a room type on one date (rate calendar).
const upsertSchema = z.object({
  roomTypeId: z.string().min(1),
  date: dateOnly,
  rate: z.number().positive(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { roomTypeId, date, rate } = parsed.data;

  const override = await prisma.rateOverride.upsert({
    where: { roomTypeId_date: { roomTypeId, date: parseDateOnly(date) } },
    create: { roomTypeId, date: parseDateOnly(date), rate },
    update: { rate },
  });
  await recordAudit("pricing.override.set", "rate_override", override.id, `Pinned ₹${Math.round(rate).toLocaleString("en-IN")} on ${date}`).catch(() => {});
  return ok(override, 201);
}

const deleteSchema = z.object({ roomTypeId: z.string().min(1), date: dateOnly });

async function handleDELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { roomTypeId, date } = parsed.data;

  await prisma.rateOverride.deleteMany({ where: { roomTypeId, date: parseDateOnly(date) } });
  await recordAudit("pricing.override.clear", "rate_override", null, `Cleared the pinned rate on ${date}`).catch(() => {});
  return ok({ deleted: true });
}

export const POST = withRoute(handlePOST);
export const DELETE = withRoute(handleDELETE);
