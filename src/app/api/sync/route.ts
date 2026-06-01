import { ok } from "@/lib/api";
import { syncAllFeeds } from "@/lib/ical-import";

// Manual "Sync now" trigger (behind the owner auth middleware).
export async function POST() {
  const results = await syncAllFeeds();
  return ok({ results, syncedAt: new Date().toISOString() });
}
