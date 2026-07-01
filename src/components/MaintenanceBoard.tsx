"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { SectionLabel } from "@/components/ui";
import { displayINR } from "@/lib/format";

type Priority = "low" | "medium" | "high";
type Status = "open" | "in_progress" | "done";
type Staff = { id: string; name: string };
type Asset = { id: string; name: string; category: string | null; preventiveEveryDays: number | null; lastServicedAt: string | null; due: boolean };
type Request = { id: string; title: string; status: Status; priority: Priority; assigneeStaffId: string | null; cost: number | null };

const PRIORITY_CLS: Record<Priority, string> = { high: "badge--danger", medium: "badge--warn", low: "badge--neutral" };
const STATUS_LABEL: Record<Status, string> = { open: "Open", in_progress: "In progress", done: "Done" };

export function MaintenanceBoard({ requests, assets, staff }: { requests: Request[]; assets: Asset[]; staff: Staff[] }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [req, setReq] = useState({ title: "", priority: "medium" as Priority, assigneeStaffId: "", cost: "" });
  const [asset, setAsset] = useState({ name: "", category: "", preventiveEveryDays: "" });
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  async function addRequest() {
    if (!req.title.trim()) return;
    if (await call("/api/maintenance", {
      title: req.title, priority: req.priority,
      assigneeStaffId: req.assigneeStaffId || null, cost: req.cost ? Number(req.cost) : null,
    })) setReq({ title: "", priority: "medium", assigneeStaffId: "", cost: "" });
  }
  async function addAsset() {
    if (!asset.name.trim()) return;
    if (await call("/api/assets", {
      name: asset.name, category: asset.category || null,
      preventiveEveryDays: asset.preventiveEveryDays ? Number(asset.preventiveEveryDays) : null,
    })) setAsset({ name: "", category: "", preventiveEveryDays: "" });
  }

  const dueAssets = assets.filter((a) => a.due);

  return (
    <div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)" }}>{error}</p>}

      {/* Requests */}
      <SectionLabel count={requests.length}>Requests</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <input className="input" placeholder="What needs fixing? (e.g. Geyser in Room 102)" value={req.title} onChange={(e) => setReq({ ...req, title: e.target.value })} style={{ marginBottom: 10 }} />
        <div className="form-grid" style={{ gap: 10 }}>
          <select className="select" value={req.priority} onChange={(e) => setReq({ ...req, priority: e.target.value as Priority })}>
            {(["low", "medium", "high"] as Priority[]).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="select" value={req.assigneeStaffId} onChange={(e) => setReq({ ...req, assigneeStaffId: e.target.value })}>
            <option value="">Assign…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="input" inputMode="numeric" placeholder="Cost ₹ (optional)" value={req.cost} onChange={(e) => setReq({ ...req, cost: e.target.value })} />
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} onClick={addRequest} disabled={!req.title.trim()}>Log request</button>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {requests.length === 0 ? <div className="empty">No maintenance requests.</div> : requests.map((r) => (
          <div key={r.id} className="rowcard">
            <div className="rowcard__main">
              <div className="rowcard__name">{r.title}</div>
              <div className="rowcard__meta">{r.cost != null ? displayINR(r.cost) : "—"}</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className={`badge ${PRIORITY_CLS[r.priority]}`}>{r.priority}</span>
              <select className="select" style={{ width: 130 }} value={r.status} onChange={(e) => call(`/api/maintenance/${r.id}`, { status: e.target.value }, "PATCH")}>
                {(["open", "in_progress", "done"] as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Assets */}
      <SectionLabel count={assets.length} action={dueAssets.length ? <span className="badge badge--warn">{dueAssets.length} due</span> : undefined}>Asset register</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <input className="input" placeholder="Asset (e.g. Generator)" value={asset.name} onChange={(e) => setAsset({ ...asset, name: e.target.value })} />
          <input className="input" placeholder="Category (optional)" value={asset.category} onChange={(e) => setAsset({ ...asset, category: e.target.value })} />
          <input className="input" inputMode="numeric" placeholder="Service every N days" value={asset.preventiveEveryDays} onChange={(e) => setAsset({ ...asset, preventiveEveryDays: e.target.value })} />
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} onClick={addAsset} disabled={!asset.name.trim()}>Add asset</button>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {assets.map((a) => (
          <div key={a.id} className="rowcard" style={a.due ? { borderColor: "var(--amber-border)", background: "var(--amber-bg)" } : undefined}>
            <div className="rowcard__main">
              <div className="rowcard__name">{a.name}{a.due && <span className="badge badge--warn" style={{ marginLeft: 8 }}>Service due</span>}</div>
              <div className="rowcard__meta">
                {[a.category, a.preventiveEveryDays ? `every ${a.preventiveEveryDays}d` : null, a.lastServicedAt ? `last ${a.lastServicedAt}` : "never serviced"].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => call(`/api/assets/${a.id}`, { service: true }, "PATCH")}>Serviced today</button>
              <button className="btn btn--quiet btn--icon btn--sm" onClick={async () => { if (await confirm({ title: "Remove asset", message: "Delete this asset?", danger: true, confirmLabel: "Delete" })) call(`/api/assets/${a.id}`, {}, "DELETE"); }} aria-label="Delete asset">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
