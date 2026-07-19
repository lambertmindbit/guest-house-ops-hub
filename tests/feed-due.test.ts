import { describe, it, expect } from "vitest";
import { feedIsDue } from "@/lib/ical-import";

// GAP-6: the cron re-fetches a feed only once its property's icalSyncHours has
// elapsed. feedIsDue is that pure decision.

const now = new Date("2026-07-19T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("feedIsDue", () => {
  it("a never-synced feed is always due", () => {
    expect(feedIsDue(null, 24, now)).toBe(true);
    expect(feedIsDue(null, 1, now)).toBe(true);
  });

  it("at a 6-hour frequency: synced 2h ago is not due; 8h ago is; exactly 6h is", () => {
    expect(feedIsDue(hoursAgo(2), 6, now)).toBe(false);
    expect(feedIsDue(hoursAgo(8), 6, now)).toBe(true);
    expect(feedIsDue(hoursAgo(6), 6, now)).toBe(true);
  });

  it("keeps the daily default: synced this morning waits, yesterday re-syncs", () => {
    expect(feedIsDue(hoursAgo(5), 24, now)).toBe(false);
    expect(feedIsDue(hoursAgo(25), 24, now)).toBe(true);
  });

  it("honours the hourly minimum", () => {
    expect(feedIsDue(hoursAgo(0.5), 1, now)).toBe(false);
    expect(feedIsDue(hoursAgo(1.5), 1, now)).toBe(true);
  });
});
