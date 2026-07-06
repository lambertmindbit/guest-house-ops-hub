import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { saveSubscription, deleteSubscription } from "@/lib/push";

// POST   /api/push/subscribe   — store a browser's Web Push subscription
// DELETE /api/push/subscribe   — remove it (owner turned notifications off)
// Owner-gated by the edge middleware (like the other /api/* app routes).

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(500), auth: z.string().max(500) }),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { endpoint, keys } = parsed.data;
  await saveSubscription({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
  return ok({ subscribed: true }, 201);
}

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) });

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  await deleteSubscription(parsed.data.endpoint);
  return ok({ unsubscribed: true });
}
