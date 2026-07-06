import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Web Push sender for owner notifications. VAPID keys come from the environment
// (see .env.example). If they're unset, push is a no-op — the feature simply
// stays dark rather than erroring, so a deploy without keys is safe.

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:owner@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushInput = { endpoint: string; p256dh: string; auth: string };

export async function saveSubscription(sub: PushInput): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { p256dh: sub.p256dh, auth: sub.auth },
    create: sub,
  });
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

// Fan out a notification to every stored subscription. Dead subscriptions
// (410 Gone / 404) are pruned so the list self-heals. Best-effort: callers wrap
// this so a push failure never breaks the action that triggered it.
export async function sendOwnerPush(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  if (!ensureConfigured()) return { sent: 0, pruned: 0 };

  const subs = await prisma.pushSubscription.findMany();
  const body = JSON.stringify(payload);
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.endpoint);
      }
    }),
  );

  if (dead.length) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: dead } } });
  return { sent, pruned: dead.length };
}
