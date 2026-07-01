import { describe, it, expect } from "vitest";
import { sumOutstanding } from "@/lib/finance";

describe("sumOutstanding", () => {
  it("sums positive balances over confirmed bookings only", () => {
    const r = sumOutstanding([
      { grossAmount: 5000, collected: 2000, status: "confirmed" }, // 3000 due
      { grossAmount: 3000, collected: 3000, status: "confirmed" }, // paid → skip
      { grossAmount: 4000, collected: 0, status: "confirmed" }, // 4000 due
      { grossAmount: 9000, collected: 0, status: "cancelled" }, // not confirmed → skip
    ]);
    expect(r).toEqual({ total: 7000, count: 2 });
  });

  it("never goes negative on overpayment", () => {
    const r = sumOutstanding([{ grossAmount: 1000, collected: 1500, status: "confirmed" }]);
    expect(r).toEqual({ total: 0, count: 0 });
  });
});
