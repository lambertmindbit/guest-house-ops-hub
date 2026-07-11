import { describe, it, expect } from "vitest";
import {
  isOwnerOnlyPath,
  housekeepingCanAccessPage,
  housekeepingCanAccessApi,
  canSeeNav,
  canSeeMoney,
} from "@/lib/authz";

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

  it("the owner console (assistant) is owner-only — it speaks finances", () => {
    // SEC-1: the in-app assistant always runs the owner agent (finance tools), so
    // reception/housekeeping must not reach the page or its transport.
    expect(isOwnerOnlyPath("/assistant")).toBe(true);
    expect(isOwnerOnlyPath("/api/assistant/message")).toBe(true);
    expect(canSeeNav("reception", "assistant")).toBe(false);
  });

  it("feed config + sync are owner-only (server-side fetch of a URL)", () => {
    expect(isOwnerOnlyPath("/api/feeds")).toBe(true);
    expect(isOwnerOnlyPath("/api/sync")).toBe(true);
  });

  it("housekeeping APIs are limited to its own screens' calls", () => {
    // SEC-1: allowed — mark-clean, tasks, nav property switch.
    expect(housekeepingCanAccessApi("/api/rooms/abc")).toBe(true);
    expect(housekeepingCanAccessApi("/api/housekeeping/tasks")).toBe(true);
    expect(housekeepingCanAccessApi("/api/session/property")).toBe(true);
    // denied — guest PII, ID documents, and booking mutations are out of scope.
    expect(housekeepingCanAccessApi("/api/guests/abc")).toBe(false);
    expect(housekeepingCanAccessApi("/api/guests/abc/id-document")).toBe(false);
    expect(housekeepingCanAccessApi("/api/reservations")).toBe(false);
    expect(housekeepingCanAccessApi("/api/assistant/message")).toBe(false);
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
