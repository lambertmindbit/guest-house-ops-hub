import { describe, it, expect } from "vitest";
import { isOwnerOnlyPath, housekeepingCanAccessPage, canSeeNav, canSeeMoney } from "@/lib/authz";

describe("authz", () => {
  it("owner-only paths cover money + config, not operational APIs", () => {
    expect(isOwnerOnlyPath("/finance")).toBe(true);
    expect(isOwnerOnlyPath("/analytics")).toBe(true);
    expect(isOwnerOnlyPath("/api/pricing/policy")).toBe(true);
    expect(isOwnerOnlyPath("/settings/users")).toBe(true);
    expect(isOwnerOnlyPath("/api/users/abc")).toBe(true);
    // operational paths staff need stay open
    expect(isOwnerOnlyPath("/reservations")).toBe(false);
    expect(isOwnerOnlyPath("/api/rooms/abc")).toBe(false); // housekeeping mark-clean
    expect(isOwnerOnlyPath("/housekeeping")).toBe(false);
  });

  it("money-export APIs are owner-only (page path differs from API path)", () => {
    // Regression: these must be gated even though the pages are at /analytics /finance.
    expect(isOwnerOnlyPath("/api/analytics/export")).toBe(true);
    expect(isOwnerOnlyPath("/api/export/payments.csv")).toBe(true);
    expect(isOwnerOnlyPath("/api/export/reservations.csv")).toBe(true);
  });

  it("housekeeping pages are limited to today + cleaning", () => {
    expect(housekeepingCanAccessPage("/")).toBe(true);
    expect(housekeepingCanAccessPage("/housekeeping")).toBe(true);
    expect(housekeepingCanAccessPage("/calendar")).toBe(false);
    expect(housekeepingCanAccessPage("/reservations")).toBe(false);
  });

  it("nav visibility per role", () => {
    expect(canSeeNav("owner", "finance")).toBe(true);
    expect(canSeeNav("reception", "finance")).toBe(false);
    expect(canSeeNav("reception", "bookings")).toBe(true);
    expect(canSeeNav("housekeeping", "housekeeping")).toBe(true);
    expect(canSeeNav("housekeeping", "calendar")).toBe(false);
  });

  it("money is owner-only", () => {
    expect(canSeeMoney("owner")).toBe(true);
    expect(canSeeMoney("reception")).toBe(false);
    expect(canSeeMoney("housekeeping")).toBe(false);
  });
});
