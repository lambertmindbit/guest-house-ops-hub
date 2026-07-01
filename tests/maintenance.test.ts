import { describe, it, expect } from "vitest";
import { preventiveDue, type AssetForDue } from "@/lib/maintenance";

const assets: AssetForDue[] = [
  { id: "geyser", name: "Geyser", preventiveEveryDays: 90, lastServicedAt: "2026-01-01" }, // long overdue
  { id: "gen", name: "Generator", preventiveEveryDays: 30, lastServicedAt: "2026-06-20" }, // due 2026-07-20 → not yet
  { id: "new", name: "New pump", preventiveEveryDays: 60, lastServicedAt: null }, // never serviced → due now
  { id: "adhoc", name: "Kettle", preventiveEveryDays: null, lastServicedAt: null }, // no schedule → never
];

describe("preventiveDue", () => {
  it("flags overdue, never-serviced-with-schedule; skips not-yet and unscheduled", () => {
    const due = preventiveDue(assets, "2026-07-01").map((a) => a.id);
    expect(due).toContain("geyser");
    expect(due).toContain("new");
    expect(due).not.toContain("gen");
    expect(due).not.toContain("adhoc");
  });
});
