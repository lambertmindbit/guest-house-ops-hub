import { describe, it, expect } from "vitest";
import { bookableReadiness, upgradeOrder, summariseUpgrade, type SetupCounts, type FleetClient } from "@/lib/fleet";

const base: SetupCounts = { propertyNamed: false, roomTypes: 0, rooms: 0, channels: 0, staff: 0 };

describe("bookableReadiness (US-702 completion criterion)", () => {
  it("a fresh deployment is not bookable and lists every required step", () => {
    const r = bookableReadiness(base);
    expect(r.bookable).toBe(false);
    expect(r.requiredRemaining).toBe(4); // property, room types, rooms, channels
  });

  it("becomes bookable exactly when a room and a channel exist (guests are inline)", () => {
    const almost = { ...base, propertyNamed: true, roomTypes: 1 };
    expect(bookableReadiness(almost).bookable).toBe(false); // no room, no channel yet
    expect(bookableReadiness({ ...almost, rooms: 2, channels: 5 }).bookable).toBe(true);
  });

  it("staff is optional — present or not, it never blocks bookable", () => {
    const ready: SetupCounts = { propertyNamed: true, roomTypes: 1, rooms: 1, channels: 1, staff: 0 };
    expect(bookableReadiness(ready).bookable).toBe(true);
    expect(bookableReadiness(ready).steps.find((s) => s.key === "staff")!.required).toBe(false);
  });
});

describe("upgradeOrder (US-703 staged rollout)", () => {
  it("puts canaries first so a bad migration is caught before the fleet", () => {
    const clients: FleetClient[] = [
      { name: "alpha", directUrl: "a" },
      { name: "canary", directUrl: "c", canary: true },
      { name: "beta", directUrl: "b" },
    ];
    expect(upgradeOrder(clients).map((c) => c.name)).toEqual(["canary", "alpha", "beta"]);
  });
});

describe("summariseUpgrade (halt-on-failure)", () => {
  it("stops at the first failure and does not report later clients as upgraded", () => {
    const r = summariseUpgrade([
      { name: "canary", ok: true },
      { name: "alpha", ok: false, error: "migration failed" },
      { name: "beta", ok: true }, // never reached in practice
    ]);
    expect(r.upgraded).toEqual(["canary"]);
    expect(r.failedAt).toBe("alpha");
    expect(r.halted).toBe(true);
  });

  it("reports a clean full rollout", () => {
    const r = summariseUpgrade([{ name: "canary", ok: true }, { name: "alpha", ok: true }]);
    expect(r).toEqual({ upgraded: ["canary", "alpha"], failedAt: null, halted: false });
  });
});
