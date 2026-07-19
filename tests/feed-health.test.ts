import { describe, it, expect } from "vitest";
import { syncAgeHours, describeSyncAge, isFeedStale, staleFeedCount } from "@/lib/feed-health";

const now = new Date("2026-07-16T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

describe("syncAgeHours", () => {
  it("is the elapsed hours, or null when never synced", () => {
    expect(syncAgeHours(null, now)).toBeNull();
    expect(syncAgeHours(hoursAgo(3), now)).toBeCloseTo(3, 5);
    expect(syncAgeHours(hoursAgo(0), now)).toBeCloseTo(0, 5);
  });
});

describe("describeSyncAge", () => {
  it("reads as a human age", () => {
    expect(describeSyncAge(null, now)).toBe("never");
    expect(describeSyncAge(hoursAgo(0.2), now)).toBe("just now");
    expect(describeSyncAge(hoursAgo(3), now)).toBe("3h ago");
    expect(describeSyncAge(hoursAgo(50), now)).toBe("2d ago");
  });
});

describe("isFeedStale (>12h default)", () => {
  it("flags an active feed synced longer ago than the threshold", () => {
    expect(isFeedStale({ active: true, lastSyncedAt: hoursAgo(13), lastError: null }, now)).toBe(true);
    expect(isFeedStale({ active: true, lastSyncedAt: hoursAgo(3), lastError: null }, now)).toBe(false);
  });
  it("flags an active feed whose last attempt errored, whatever its age", () => {
    expect(isFeedStale({ active: true, lastSyncedAt: hoursAgo(1), lastError: "404" }, now)).toBe(true);
  });
  it("does NOT flag a brand-new never-synced feed (just waiting for the first cron)", () => {
    expect(isFeedStale({ active: true, lastSyncedAt: null, lastError: null }, now)).toBe(false);
  });
  it("ignores inactive feeds entirely", () => {
    expect(isFeedStale({ active: false, lastSyncedAt: hoursAgo(99), lastError: "x" }, now)).toBe(false);
  });
});

describe("staleFeedCount", () => {
  it("counts only the stale, active feeds", () => {
    const feeds = [
      { active: true, lastSyncedAt: hoursAgo(20), lastError: null }, // stale
      { active: true, lastSyncedAt: hoursAgo(2), lastError: null }, // fresh
      { active: true, lastSyncedAt: hoursAgo(1), lastError: "boom" }, // errored → stale
      { active: false, lastSyncedAt: hoursAgo(40), lastError: null }, // inactive
    ];
    expect(staleFeedCount(feeds, now)).toBe(2);
  });
});
