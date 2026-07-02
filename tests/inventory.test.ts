import { describe, it, expect } from "vitest";
import { lowStock, consumptionByItem } from "@/lib/inventory";

describe("lowStock", () => {
  it("flags items at or below their threshold", () => {
    const low = lowStock([
      { id: "a", quantity: 2, minThreshold: 5 }, // low
      { id: "b", quantity: 5, minThreshold: 5 }, // low (at)
      { id: "c", quantity: 9, minThreshold: 5 }, // ok
    ] as { id: string; quantity: number; minThreshold: number }[]);
    expect(low.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("consumptionByItem", () => {
  it("sums units out (negative deltas) per item", () => {
    const c = consumptionByItem([
      { itemId: "soap", delta: -3 },
      { itemId: "soap", delta: 10 }, // restock — ignored
      { itemId: "soap", delta: -2 },
      { itemId: "tea", delta: -1 },
    ]);
    expect(c).toEqual({ soap: 5, tea: 1 });
  });
});
