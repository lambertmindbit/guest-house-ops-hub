import { ok, withRoute } from "@/lib/api";
import { syncAllFeeds } from "@/lib/ical-import";

// Manual "Sync now" trigger (behind the owner auth middleware).
async function handlePOST() {
  const results = await syncAllFeeds();
  return ok({ results, syncedAt: new Date().toISOString() });
}

export const POST = withRoute(handlePOST);
