import { withRoute } from "@/lib/api";
import { syncAllFeeds } from "@/lib/ical-import";
import { countConflicts } from "@/lib/conflicts";
import { notifyAfterSync, notifyCronFailure } from "@/lib/notify";

// Daily Vercel Cron target. This route is NOT behind the owner cookie (cron has
// no session), so it is gated by CRON_SECRET instead: Vercel sends
// `Authorization: Bearer <CRON_SECRET>` when that env var is set.
async function handleGET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Push the owner if this background run introduces new conflicts or a feed fails
  // (GAP-14) — they aren't watching the sync happen. Best-effort.
  try {
    const conflictsBefore = await countConflicts().catch(() => 0);
    const results = await syncAllFeeds({ respectFrequency: true });
    await notifyAfterSync(conflictsBefore, results);
    return Response.json({ data: { results, syncedAt: new Date().toISOString() } });
  } catch (e) {
    await notifyCronFailure("sync", e); // don't let a background failure be silent
    throw e;
  }
}

export const GET = withRoute(handleGET);
