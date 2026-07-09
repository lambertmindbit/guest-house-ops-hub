import { describe, it, expect } from "vitest";
import { dateInTimeZone } from "@/lib/dates";

// Regression for the timezone bug: "today" must be the PROPERTY's calendar date,
// not the server's. On Vercel the runtime is UTC, so the old server-offset math
// returned the wrong day during the small hours in +offset zones.

describe("dateInTimeZone", () => {
  it("resolves the property's date across the UTC day boundary", () => {
    // 2026-07-15 21:00 UTC  ==  2026-07-16 02:30 IST (UTC+5:30).
    // The property's calendar date is the 16th even though UTC is still the 15th.
    const instant = new Date("2026-07-15T21:00:00.000Z");
    expect(dateInTimeZone(instant, "Asia/Kolkata")).toBe("2026-07-16");
    expect(dateInTimeZone(instant, "UTC")).toBe("2026-07-15");
  });

  it("agrees with UTC during daytime when the dates line up", () => {
    // 2026-07-15 06:00 UTC == 2026-07-15 11:30 IST — same calendar date.
    const instant = new Date("2026-07-15T06:00:00.000Z");
    expect(dateInTimeZone(instant, "Asia/Kolkata")).toBe("2026-07-15");
    expect(dateInTimeZone(instant, "UTC")).toBe("2026-07-15");
  });

  it("handles a negative-offset zone the other way", () => {
    // 2026-07-15 02:00 UTC == 2026-07-14 21:00 America/New_York (UTC-5) — prior day.
    const instant = new Date("2026-07-15T02:00:00.000Z");
    expect(dateInTimeZone(instant, "America/New_York")).toBe("2026-07-14");
  });
});
