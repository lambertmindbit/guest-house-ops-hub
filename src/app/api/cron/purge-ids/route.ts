import { withRoute } from "@/lib/api";
import { purgeExpiredIdDocuments } from "@/lib/id-retention";
import { notifyCronFailure } from "@/lib/notify";

// Daily Vercel Cron target for the ID-document retention purge. Not behind the
// owner cookie (cron has no session) — gated by CRON_SECRET, same as cron/sync.
async function handleGET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const result = await purgeExpiredIdDocuments();
    return Response.json({ data: { ...result, purgedAt: new Date().toISOString() } });
  } catch (e) {
    await notifyCronFailure("purge-ids", e);
    throw e;
  }
}

export const GET = withRoute(handleGET);
