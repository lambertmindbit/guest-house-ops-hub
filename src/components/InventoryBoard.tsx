"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { SectionLabel } from "@/components/ui";

type Item = { id: string; name: string; unit: string | null; quantity: number; minThreshold: number; low: boolean };

export function InventoryBoard({ items }: { items: Item[] }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [nItem, setNItem] = useState({ name: "", unit: "", minThreshold: "" });
  const [amt, setAmt] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  async function addItem() {
    if (!nItem.name.trim()) return;
    if (await call("/api/inventory", { name: nItem.name, unit: nItem.unit || null, minThreshold: nItem.minThreshold ? Number(nItem.minThreshold) : 0 })) {
      setNItem({ name: "", unit: "", minThreshold: "" });
    }
  }
  async function move(id: string, sign: 1 | -1) {
    const n = Number(amt[id] || "1");
    if (!n || n <= 0) return;
    if (await call(`/api/inventory/${id}/movement`, { delta: sign * n })) setAmt((a) => ({ ...a, [id]: "" }));
  }

  const low = items.filter((i) => i.low);

  return (
    <div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)" }}>{error}</p>}

      {low.length > 0 && (
        <div className="banner banner--warn" style={{ marginBottom: 12 }}>
          <span className="banner__icon">!</span>
          <span className="banner__txt"><b>{low.length} item{low.length === 1 ? "" : "s"} low</b> — {low.map((i) => i.name).join(", ")}</span>
        </div>
      )}

      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <input className="input" placeholder="Item (e.g. Hand soap)" value={nItem.name} onChange={(e) => setNItem({ ...nItem, name: e.target.value })} />
          <input className="input" placeholder="Unit (pcs, kg…)" value={nItem.unit} onChange={(e) => setNItem({ ...nItem, unit: e.target.value })} />
          <input className="input" inputMode="numeric" placeholder="Low-stock threshold" value={nItem.minThreshold} onChange={(e) => setNItem({ ...nItem, minThreshold: e.target.value })} />
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} onClick={addItem} disabled={!nItem.name.trim()}>Add item</button>
      </div>

      <SectionLabel count={items.length}>Stock</SectionLabel>
      <div className="col" style={{ gap: 8 }}>
        {items.length === 0 ? <div className="empty">No items yet.</div> : items.map((i) => (
          <div key={i.id} className="rowcard" style={i.low ? { borderColor: "var(--amber-border)", background: "var(--amber-bg)" } : undefined}>
            <div className="rowcard__main">
              <div className="rowcard__name">{i.name}{i.low && <span className="badge badge--warn" style={{ marginLeft: 8 }}>Low</span>}</div>
              <div className="rowcard__meta"><b className="num" style={{ color: "var(--ink)" }}>{i.quantity}</b>{i.unit ? ` ${i.unit}` : ""} · min {i.minThreshold}</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <input className="input" inputMode="numeric" placeholder="1" value={amt[i.id] ?? ""} onChange={(e) => setAmt((a) => ({ ...a, [i.id]: e.target.value }))} style={{ width: 56, padding: "6px 8px" }} />
              <button className="btn btn--success btn--sm" onClick={() => move(i.id, 1)}>In</button>
              <button className="btn btn--ghost btn--sm" onClick={() => move(i.id, -1)}>Out</button>
              <button className="btn btn--quiet btn--icon btn--sm" onClick={async () => { if (await confirm({ title: "Remove item", message: "Delete this item and its history?", danger: true, confirmLabel: "Delete" })) call(`/api/inventory/${i.id}`, {}, "DELETE"); }} aria-label="Delete item">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
