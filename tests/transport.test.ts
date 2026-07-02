import { describe, it, expect } from "vitest";
import { fareRollup } from "@/lib/transport";

describe("fareRollup", () => {
  it("sums completed fares and counts by status", () => {
    const r = fareRollup([
      { status: "done", fare: 500 },
      { status: "done", fare: null }, // completed, no fare recorded
      { status: "planned", fare: 300 },
      { status: "cancelled", fare: 200 },
    ]);
    expect(r.doneFares).toBe(500);
    expect(r.doneCount).toBe(2);
    expect(r.plannedCount).toBe(1);
  });
});
