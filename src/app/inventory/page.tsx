import { listItems, lowStock } from "@/lib/inventory";
import { PageHead } from "@/components/ui";
import { InventoryBoard } from "@/components/InventoryBoard";
import { requireModule } from "@/lib/module-gate";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await requireModule("inventory");
  const items = await listItems();
  const lowIds = new Set(lowStock(items).map((i) => i.id));

  return (
    <main className="app-main" style={{ maxWidth: 820 }}>
      <div className="entrance">
        <PageHead title="Inventory" sub="Supplies, stock in/out and low-stock alerts." />
        <InventoryBoard
          items={items.map((i) => ({
            id: i.id, name: i.name, unit: i.unit, quantity: i.quantity, minThreshold: i.minThreshold, low: lowIds.has(i.id),
          }))}
        />
      </div>
    </main>
  );
}
