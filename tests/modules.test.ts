import { describe, expect, it } from "vitest";
import { MODULES, isToggleable, isModuleEnabled, disabledSet, moduleForRoute } from "@/lib/modules";

// Module visibility is a packaging feature, but two of its failure modes are not
// cosmetic:
//
//   1. Hiding a CORE module would brick the client's app — no calendar, no
//      bookings, and (since /settings is core) no way to switch it back on.
//   2. Over-matching a route prefix would 404 a page that has nothing to do with
//      the module — /inventory must not swallow a future /inventory-report.
//
// Both are pinned here.

const CORE = [
  "today", "calendar", "bookings", "guests", "housekeeping",
  "needsyou", "finance", "pricing", "analytics", "settings",
];

describe("module registry", () => {
  it("refuses to treat a core module as toggleable", () => {
    for (const id of CORE) {
      expect(isToggleable(id)).toBe(false);
    }
  });

  it("cannot hide a core module even if the database says so", () => {
    // A stray or hand-edited row must not be able to take the calendar away.
    const hostile = ["calendar", "finance", "settings", "bookings"];
    expect([...disabledSet(hostile)]).toEqual([]);
  });

  it("ignores unknown ids rather than throwing", () => {
    expect([...disabledSet(["not-a-module", "groups"])]).toEqual(["groups"]);
  });

  it("treats a module as enabled unless it is explicitly disabled", () => {
    // The empty case is the important one: a fresh property shows the whole
    // product, because we store what's OFF, not what's ON.
    expect(isModuleEnabled("groups", [])).toBe(true);
    expect(isModuleEnabled("groups", ["groups"])).toBe(false);
    expect(isModuleEnabled("groups", ["inventory"])).toBe(true);
  });

  it("every module declares at least one route, and no route is claimed twice", () => {
    const seen = new Map<string, string>();
    for (const m of MODULES) {
      expect(m.routes.length).toBeGreaterThan(0);
      for (const r of m.routes) {
        expect(r.startsWith("/")).toBe(true);
        expect(seen.has(r)).toBe(false); // two modules owning one route = undefined behaviour
        seen.set(r, m.id);
      }
    }
  });
});

describe("moduleForRoute", () => {
  it("claims the module's own page and its children", () => {
    expect(moduleForRoute("/inventory")).toBe("inventory");
    expect(moduleForRoute("/inventory/abc123")).toBe("inventory");
    expect(moduleForRoute("/directory")).toBe("directory");
    expect(moduleForRoute("/directories")).toBe("directory");
  });

  it("does NOT over-match a route that merely starts with the same letters", () => {
    // The bug this prevents: /inventory silently 404-ing a future
    // /inventory-report, or /partners swallowing /partnership.
    expect(moduleForRoute("/inventory-report")).toBeNull();
    expect(moduleForRoute("/partnerships")).toBeNull();
    expect(moduleForRoute("/staffing")).toBeNull();
  });

  it("returns null for core routes, so they are never gated", () => {
    for (const r of ["/", "/calendar", "/reservations", "/guests", "/finance", "/settings"]) {
      expect(moduleForRoute(r)).toBeNull();
    }
  });
});
