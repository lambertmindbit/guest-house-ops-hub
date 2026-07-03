"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { SectionLabel } from "@/components/ui";

type Partner = { id: string; name: string; kind: string | null; phone: string | null; locality: string | null; rating: number | null; notes: string | null };

const KINDS = ["guesthouse", "hotel", "homestay", "driver", "agent", "other"];
const KIND_LABEL: Record<string, string> = { guesthouse: "Guesthouse", hotel: "Hotel", homestay: "Homestay", driver: "Driver", agent: "Agent", other: "Other" };

const EMPTY = { name: "", kind: "", phone: "", locality: "", rating: "", notes: "" };

export function PartnersBoard({ partners }: { partners: Partner[] }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [np, setNp] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState(EMPTY);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  function toBody(f: typeof EMPTY) {
    return {
      name: f.name.trim(), kind: f.kind || null, phone: f.phone.trim() || null,
      locality: f.locality.trim() || null, rating: f.rating ? Number(f.rating) : null, notes: f.notes.trim() || null,
    };
  }
  function startEdit(p: Partner) {
    setEditId(p.id);
    setEdit({ name: p.name, kind: p.kind ?? "", phone: p.phone ?? "", locality: p.locality ?? "", rating: p.rating ? String(p.rating) : "", notes: p.notes ?? "" });
  }
  async function saveEdit(id: string) {
    if (!edit.name.trim()) return;
    if (await call(`/api/partners/${id}`, toBody(edit), "PATCH")) setEditId(null);
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? partners.filter((p) => [p.name, p.kind, p.phone, p.locality].some((v) => v?.toLowerCase().includes(needle)))
    : partners;

  function fields(f: typeof EMPTY, set: (v: typeof EMPTY) => void) {
    return (
      <div className="form-grid" style={{ gap: 10 }}>
        <input className="input" placeholder="Name" value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} />
        <select className="select" value={f.kind} onChange={(e) => set({ ...f, kind: e.target.value })}>
          <option value="">Type…</option>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <input className="input" placeholder="Phone" value={f.phone} onChange={(e) => set({ ...f, phone: e.target.value })} />
        <input className="input" placeholder="Area / locality" value={f.locality} onChange={(e) => set({ ...f, locality: e.target.value })} />
        <select className="select" value={f.rating} onChange={(e) => set({ ...f, rating: e.target.value })}>
          <option value="">Rating…</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
        </select>
        <input className="input" placeholder="Notes" value={f.notes} onChange={(e) => set({ ...f, notes: e.target.value })} />
      </div>
    );
  }

  return (
    <div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)" }}>{error}</p>}

      {/* Add */}
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        {fields(np, setNp)}
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!np.name.trim()}
          onClick={async () => { if (await call("/api/partners", toBody(np))) setNp(EMPTY); }}>
          Add partner
        </button>
      </div>

      <SectionLabel count={partners.length}>Partners</SectionLabel>
      {partners.length > 6 && (
        <input className="input" placeholder="Search name, type, area…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      )}

      <div className="col" style={{ gap: 8 }}>
        {shown.length === 0 ? <div className="empty">No partners yet. Add the places and people you work with.</div> : shown.map((p) => (
          editId === p.id ? (
            <div key={p.id} className="card card--pad" style={{ padding: 12 }}>
              {fields(edit, setEdit)}
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button className="btn btn--primary btn--sm" onClick={() => saveEdit(p.id)} disabled={!edit.name.trim()}>Save</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setEditId(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={p.id} className="rowcard">
              <div className="rowcard__main">
                <div className="rowcard__name">{p.name}{p.kind ? <span className="badge badge--neutral" style={{ marginLeft: 8 }}>{KIND_LABEL[p.kind] ?? p.kind}</span> : null}{p.rating ? ` · ${p.rating}★` : ""}</div>
                <div className="rowcard__meta">{[p.locality, p.notes].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {p.phone && <a className="btn btn--ghost btn--sm" href={`tel:${p.phone}`}>{p.phone}</a>}
                <button className="btn btn--ghost btn--sm" onClick={() => startEdit(p)}>Edit</button>
                <button className="btn btn--quiet btn--icon btn--sm" onClick={async () => { if (await confirm({ title: "Remove partner", message: "Delete this partner? Referrals that point to them stay, unlinked.", danger: true, confirmLabel: "Delete" })) call(`/api/partners/${p.id}`, {}, "DELETE"); }} aria-label="Delete partner">✕</button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
