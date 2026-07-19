// Sync-health helpers for iCal feeds (GAP-5). Pure, so the staleness rule is
// testable and shared between the Feeds screen and the Today warning. "Stale"
// means an ACTIVE feed whose last successful sync is older than the threshold, or
// whose last attempt errored — the case where imported OTA busy-dates silently go
// out of date and a cross-channel double-book can slip through unnoticed.

export type FeedHealth = { active: boolean; lastSyncedAt: string | Date | null; lastError: string | null };

const HOUR_MS = 3_600_000;

// Hours since the last successful sync, or null if it never synced.
export function syncAgeHours(lastSyncedAt: string | Date | null, now: Date): number | null {
  if (!lastSyncedAt) return null;
  const t = typeof lastSyncedAt === "string" ? Date.parse(lastSyncedAt) : lastSyncedAt.getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now.getTime() - t) / HOUR_MS);
}

// Human-friendly age: "just now" / "3h ago" / "2d ago" / "never".
export function describeSyncAge(lastSyncedAt: string | Date | null, now: Date): string {
  const h = syncAgeHours(lastSyncedAt, now);
  if (h === null) return "never";
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// A previously-synced active feed that has gone stale (> threshold) or whose last
// attempt errored. A brand-new never-synced feed is NOT flagged — it's just
// waiting for the first cron run, not a silent failure. A dead cron surfaces here
// anyway: previously-healthy feeds cross the threshold on their own.
export function isFeedStale(feed: FeedHealth, now: Date, thresholdHours = 12): boolean {
  if (!feed.active) return false;
  if (feed.lastError) return true;
  const h = syncAgeHours(feed.lastSyncedAt, now);
  return h !== null && h > thresholdHours;
}

export function staleFeedCount(feeds: FeedHealth[], now: Date, thresholdHours = 12): number {
  return feeds.filter((f) => isFeedStale(f, now, thresholdHours)).length;
}
