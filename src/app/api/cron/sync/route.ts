import { withRoute } from "@/lib/api";
import { syncAllFeeds } from "@/lib/ical-import";

// Daily Vercel Cron target. This route is NOT behind the owner cookie (cron has
// no session), so it is gated by CRON_SECRET instead: Vercel sends
// `Authorization: Bearer <CRON_SECRET>` when that env var is set.
async function handleGET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const results = await syncAllFeeds({ respectFrequency: true });
  return Response.json({ data: { results, syncedAt: new Date().toISOString() } });
}

export const GET = withRoute(handleGET);
