import { describe, it, expect } from "vitest";
import { describeAudit } from "@/lib/audit";

describe("describeAudit", () => {
  it("prefers an explicit summary", () => {
    expect(describeAudit({ action: "reservation.cancel", entityType: "reservation", summary: "Cancelled — Alice" })).toBe("Cancelled — Alice");
  });
  it("falls back to action on entity", () => {
    expect(describeAudit({ action: "user.delete", entityType: "user", summary: null })).toBe("user.delete on user");
  });
});
