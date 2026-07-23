import { withRoute } from "@/lib/api";
import { runMessagingTriggers } from "@/lib/messaging";
import { notifyCronFailure } from "@/lib/notify";

// Daily Vercel Cron target for scheduled guest notifications (pre-arrival +
// payment reminders). Not behind the owner cookie — gated by CRON_SECRET, same
// as the other cron routes. Idempotent: re-running never double-messages.
async function handleGET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const result = await runMessagingTriggers();
    return Response.json({ data: { ...result, ranAt: new Date().toISOString() } });
  } catch (e) {
    await notifyCronFailure("messaging", e);
    throw e;
  }
}

export const GET = withRoute(handleGET);
