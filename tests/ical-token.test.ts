import { beforeAll, describe, expect, it } from "vitest";
import { icalTokenForRoom, icalTokenValid } from "@/lib/ical-token";

beforeAll(() => {
  process.env.ICAL_FEED_TOKEN = "test-secret";
});

describe("per-room iCal token", () => {
  it("a room's token validates for that room only", () => {
    const tokenA = icalTokenForRoom("room-A");
    expect(icalTokenValid("room-A", tokenA)).toBe(true);
    // The same token must NOT open a different room — this is the whole point.
    expect(icalTokenValid("room-B", tokenA)).toBe(false);
  });

  it("rejects a forged/garbage token", () => {
    expect(icalTokenValid("room-A", "not-a-real-token")).toBe(false);
    expect(icalTokenValid("room-A", "")).toBe(false);
  });

  it("tokens differ per room", () => {
    expect(icalTokenForRoom("room-A")).not.toBe(icalTokenForRoom("room-B"));
  });
});
