"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { SectionLabel } from "@/components/ui";
import { displayINR } from "@/lib/format";

type PoStatus = "draft" | "ordered" | "received";
type Vendor = { id: string; name: string; category: string | null; contact: string | null; rating: number | null };
type PO = { id: string; vendorName: string; description: string; amount: number; status: PoStatus };
type Payment = { id: string; vendorName: string; amount: number; paidAt: string };
type Summary = { ordered: number; received: number; paid: number; outstanding: number };

const STATUS_LABEL: Record<PoStatus, string> = { draft: "Draft", ordered: "Ordered", received: "Received" };

export function VendorsBoard({ vendors, pos, payments, summary }: { vendors: Vendor[]; pos: PO[]; payments: Payment[]; summary: Summary }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [nv, setNv] = useState({ name: "", category: "", contact: "", rating: "" });
  const [po, setPo] = useState({ vendorId: "", description: "", amount: "", status: "ordered" as PoStatus });
  const [pay, setPay] = useState({ vendorId: "", amount: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", category: "", contact: "", rating: "" });
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  function startEdit(v: Vendor) {
    setEditId(v.id);
    setEdit({ name: v.name, category: v.category ?? "", contact: v.contact ?? "", rating: v.rating ? String(v.rating) : "" });
  }
  async function saveEdit(id: string) {
    if (!edit.name.trim()) return;
    if (await call(`/api/vendors/${id}`, { name: edit.name.trim(), category: edit.category.trim() || null, contact: edit.contact.trim() || null, rating: edit.rating ? Number(edit.rating) : null }, "PATCH")) {
      setEditId(null);
    }
  }

  return (
    <div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)" }}>{error}</p>}

      <div className="kpi-strip" style={{ marginBottom: 14 }}>
        <div className="kpi-panel kpi-panel--verdict"><div className="kpi-eyebrow">Outstanding</div><div className="kpi-num">{displayINR(summary.outstanding)}</div><div className="kpi-ctx">to vendors</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Ordered</div><div className="kpi-num">{displayINR(summary.ordered)}</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Received</div><div className="kpi-num">{displayINR(summary.received)}</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Paid</div><div className="kpi-num">{displayINR(summary.paid)}</div></div>
      </div>

      {/* Directory */}
      <SectionLabel count={vendors.length}>Vendors</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <input className="input" placeholder="Vendor name" value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} />
          <input className="input" placeholder="Category (laundry, grocery…)" value={nv.category} onChange={(e) => setNv({ ...nv, category: e.target.value })} />
          <input className="input" placeholder="Contact (phone)" value={nv.contact} onChange={(e) => setNv({ ...nv, contact: e.target.value })} />
          <select className="select" value={nv.rating} onChange={(e) => setNv({ ...nv, rating: e.target.value })}>
            <option value="">Rating…</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
          </select>
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!nv.name.trim()}
          onClick={async () => { if (await call("/api/vendors", { name: nv.name, category: nv.category || null, contact: nv.contact || null, rating: nv.rating ? Number(nv.rating) : null })) setNv({ name: "", category: "", contact: "", rating: "" }); }}>
          Add vendor
        </button>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {vendors.map((v) => (
          editId === v.id ? (
            <div key={v.id} className="card card--pad" style={{ padding: 12 }}>
              <div className="form-grid" style={{ gap: 10 }}>
                <input className="input" placeholder="Vendor name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <input className="input" placeholder="Category" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
                <input className="input" placeholder="Contact" value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} />
                <select className="select" value={edit.rating} onChange={(e) => setEdit({ ...edit, rating: e.target.value })}>
                  <option value="">Rating…</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
                </select>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button className="btn btn--primary btn--sm" onClick={() => saveEdit(v.id)} disabled={!edit.name.trim()}>Save</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setEditId(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={v.id} className="rowcard">
              <div className="rowcard__main">
                <div className="rowcard__name">{v.name}{v.rating ? ` · ${v.rating}★` : ""}</div>
                <div className="rowcard__meta">{[v.category, v.contact].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn--ghost btn--sm" onClick={() => startEdit(v)}>Edit</button>
                <button className="btn btn--quiet btn--icon btn--sm" onClick={async () => { if (await confirm({ title: "Remove vendor", message: "Delete this vendor and its orders/payments?", danger: true, confirmLabel: "Delete" })) call(`/api/vendors/${v.id}`, {}, "DELETE"); }} aria-label="Delete vendor">✕</button>
              </div>
            </div>
          )
        ))}
      </div>

      {/* Purchase orders */}
      <SectionLabel count={pos.length}>Purchase orders</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <select className="select" value={po.vendorId} onChange={(e) => setPo({ ...po, vendorId: e.target.value })}>
            <option value="">Vendor…</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <input className="input" placeholder="What (e.g. 20kg rice)" value={po.description} onChange={(e) => setPo({ ...po, description: e.target.value })} />
          <input className="input" inputMode="numeric" placeholder="Amount ₹" value={po.amount} onChange={(e) => setPo({ ...po, amount: e.target.value })} />
          <select className="select" value={po.status} onChange={(e) => setPo({ ...po, status: e.target.value as PoStatus })}>
            {(["draft", "ordered", "received"] as PoStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!po.vendorId || !po.description.trim() || !po.amount}
          onClick={async () => { if (await call("/api/purchase-orders", { vendorId: po.vendorId, description: po.description, amount: Number(po.amount), status: po.status })) setPo({ vendorId: "", description: "", amount: "", status: "ordered" }); }}>
          Create PO
        </button>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {pos.map((p) => (
          <div key={p.id} className="rowcard">
            <div className="rowcard__main">
              <div className="rowcard__name">{p.description}</div>
              <div className="rowcard__meta">{p.vendorName} · {displayINR(p.amount)}</div>
            </div>
            <select className="select" style={{ width: 130 }} value={p.status} onChange={(e) => call(`/api/purchase-orders/${p.id}`, { status: e.target.value }, "PATCH")}>
              {(["draft", "ordered", "received"] as PoStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Payments */}
      <SectionLabel count={payments.length}>Vendor payments</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <select className="select" value={pay.vendorId} onChange={(e) => setPay({ ...pay, vendorId: e.target.value })} style={{ flex: 1 }}>
            <option value="">Vendor…</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <input className="input" inputMode="numeric" placeholder="Amount ₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} style={{ flex: 1 }} />
          <button className="btn btn--primary btn--sm" disabled={!pay.vendorId || !pay.amount}
            onClick={async () => { if (await call("/api/vendor-payments", { vendorId: pay.vendorId, amount: Number(pay.amount) })) setPay({ vendorId: "", amount: "" }); }}>Record</button>
        </div>
      </div>
      <div className="col" style={{ gap: 6 }}>
        {payments.map((p) => (
          <div key={p.id} className="spread" style={{ fontSize: "var(--fs-small)", padding: "6px 0", borderTop: "1px solid var(--border-subtle)" }}>
            <span>{p.vendorName}</span><span className="num">{displayINR(p.amount)} · {p.paidAt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
