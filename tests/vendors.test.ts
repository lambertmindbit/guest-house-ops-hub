import { describe, it, expect } from "vitest";
import { procurementSummary } from "@/lib/vendors";

describe("procurementSummary", () => {
  it("totals ordered (non-draft), received, paid, and outstanding", () => {
    const s = procurementSummary(
      [
        { amount: 1000, status: "received" },
        { amount: 500, status: "ordered" },
        { amount: 300, status: "draft" }, // excluded from ordered
      ],
      [{ amount: 400 }, { amount: 200 }],
    );
    expect(s.ordered).toBe(1500); // received + ordered, not draft
    expect(s.received).toBe(1000);
    expect(s.paid).toBe(600);
    expect(s.outstanding).toBe(400); // received 1000 − paid 600
  });

  it("never reports negative outstanding on overpayment", () => {
    const s = procurementSummary([{ amount: 100, status: "received" }], [{ amount: 250 }]);
    expect(s.outstanding).toBe(0);
  });
});
