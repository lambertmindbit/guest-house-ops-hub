import { afterAll, describe, it, expect } from "vitest";
import { prisma, __resetTenantResolution } from "@/lib/prisma";
import { lowStock, consumptionByItem, applyMovement } from "@/lib/inventory";

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

describe("applyMovement (atomic + guard)", () => {
  const TAG = `inv-${Date.now()}`;
  afterAll(async () => {
    const items = await prisma.inventoryItem.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
    await prisma.stockMovement.deleteMany({ where: { itemId: { in: items.map((i) => i.id) } } });
    await prisma.inventoryItem.deleteMany({ where: { name: { startsWith: TAG } } });
    __resetTenantResolution();
    await prisma.$disconnect();
  });

  it("adds/removes stock and keeps quantity == sum(movements)", async () => {
    const item = await prisma.inventoryItem.create({ data: { name: `${TAG}-soap`, quantity: 5, minThreshold: 2 } });
    const r1 = await applyMovement(item.id, 10);
    expect(r1.ok && r1.item.quantity).toBe(15);
    const r2 = await applyMovement(item.id, -4);
    expect(r2.ok && r2.item.quantity).toBe(11);
  });

  it("rejects an out-movement that would go negative — no silent clamp", async () => {
    const item = await prisma.inventoryItem.create({ data: { name: `${TAG}-tea`, quantity: 3, minThreshold: 1 } });
    const r = await applyMovement(item.id, -5);
    expect(r).toEqual({ ok: false, reason: "insufficient", have: 3 });
    const after = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
    expect(after?.quantity).toBe(3); // unchanged
    const movements = await prisma.stockMovement.count({ where: { itemId: item.id } });
    expect(movements).toBe(0); // no movement row written on rejection
  });

  it("returns not_found for a missing item", async () => {
    expect(await applyMovement("does-not-exist", 1)).toEqual({ ok: false, reason: "not_found" });
  });
});
