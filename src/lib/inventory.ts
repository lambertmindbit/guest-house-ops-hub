import { prisma } from "@/lib/prisma";

export async function listItems() {
  return prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
}

export async function createItem(data: { name: string; unit?: string | null; minThreshold?: number }) {
  return prisma.inventoryItem.create({
    data: { name: data.name, unit: data.unit ?? null, minThreshold: data.minThreshold ?? 0 },
  });
}

// Record a stock movement (+in / -out) and adjust the derived quantity in one
// transaction. Quantity never goes below 0.
export async function applyMovement(itemId: string, delta: number, reason?: string | null) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) return null;
    await tx.stockMovement.create({ data: { itemId, delta, reason: reason ?? null } });
    return tx.inventoryItem.update({ where: { id: itemId }, data: { quantity: Math.max(0, item.quantity + delta) } });
  });
}

// ── Pure (testable) ──────────────────────────────────────────────────────────
export type ItemForLow = { quantity: number; minThreshold: number };
export function lowStock<T extends ItemForLow>(items: T[]): T[] {
  return items.filter((i) => i.quantity <= i.minThreshold);
}

export type MovementForConsumption = { itemId: string; delta: number };
// Total consumed (units out) per item over the given movements.
export function consumptionByItem(movements: MovementForConsumption[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of movements) if (m.delta < 0) out[m.itemId] = (out[m.itemId] ?? 0) + -m.delta;
  return out;
}
