import { describe, it, expect } from "vitest";
import { folioTotal } from "@/lib/groups";

describe("folioTotal", () => {
  it("sums gross + collected across child bookings and derives balance", () => {
    const f = folioTotal([
      { gross: 5000, collected: 2000 },
      { gross: 3000, collected: 3000 },
      { gross: null, collected: 0 }, // amount not set yet
    ]);
    expect(f.gross).toBe(8000);
    expect(f.collected).toBe(5000);
    expect(f.balance).toBe(3000);
  });

  it("never reports negative balance", () => {
    expect(folioTotal([{ gross: 100, collected: 300 }]).balance).toBe(0);
  });
});
