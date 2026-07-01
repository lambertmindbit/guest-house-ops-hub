import { describe, it, expect } from "vitest";
import { summarizeComplaints, type ComplaintRowForReport } from "@/lib/complaints";

const rows: ComplaintRowForReport[] = [
  { category: "maintenance", status: "resolved", createdAt: "2026-07-01T00:00:00Z", resolvedAt: "2026-07-01T02:00:00Z" }, // 2h
  { category: "maintenance", status: "open", createdAt: "2026-07-02T00:00:00Z", resolvedAt: null },
  { category: "food", status: "resolved", createdAt: "2026-07-01T00:00:00Z", resolvedAt: "2026-07-01T04:00:00Z" }, // 4h
  { category: "noise", status: "in_progress", createdAt: "2026-07-03T00:00:00Z", resolvedAt: null },
];

describe("summarizeComplaints", () => {
  it("counts totals and open (non-resolved)", () => {
    const r = summarizeComplaints(rows);
    expect(r.total).toBe(4);
    expect(r.openTotal).toBe(2); // one open + one in_progress
  });

  it("groups by category, most frequent first", () => {
    const r = summarizeComplaints(rows);
    expect(r.byCategory[0]).toEqual({ category: "maintenance", count: 2 });
    expect(r.byCategory.map((c) => c.category)).toContain("food");
  });

  it("averages resolution time over resolved complaints only", () => {
    const r = summarizeComplaints(rows);
    expect(r.avgResolutionHours).toBe(3); // (2h + 4h) / 2
  });

  it("returns null average when nothing is resolved", () => {
    const r = summarizeComplaints([{ category: "food", status: "open", createdAt: "2026-07-01T00:00:00Z", resolvedAt: null }]);
    expect(r.avgResolutionHours).toBeNull();
  });
});
