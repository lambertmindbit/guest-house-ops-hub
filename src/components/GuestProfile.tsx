"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type GuestProfileValues = {
  id: string;
  name: string;
  email: string;
  idNumber: string;
  notes: string;
  blocked: boolean;
  blockReason: string;
};

export function GuestProfile({ initial }: { initial: GuestProfileValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/guests/${v.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: v.name,
        email: v.email || null,
        idNumber: v.idNumber || null,
        notes: v.notes || null,
        blocked: v.blocked,
        blockReason: v.blocked ? v.blockReason || null : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      {error && <p style={{ color: "var(--danger-700)", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}

      <div className="form-grid" style={{ gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Name</label>
          <input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="Optional" />
        </div>
        <div>
          <label className="field-label">ID number</label>
          <input className="input" value={v.idNumber} onChange={(e) => setV({ ...v, idNumber: e.target.value })} placeholder="Passport / Aadhaar / etc." />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Notes</label>
          <textarea className="textarea" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Preferences, allergies, history…" />
        </div>
      </div>

      <div className="tweaks__row" style={{ padding: "14px 0 2px", borderTop: "1px solid var(--line)", marginTop: 14 }}>
        <label style={{ fontWeight: 600, color: v.blocked ? "var(--danger-700)" : "var(--ink)" }}>Blacklist this guest</label>
        <button type="button" className={`switch${v.blocked ? " on" : ""}`} onClick={() => setV({ ...v, blocked: !v.blocked })} aria-label="Blacklist"><span /></button>
      </div>
      {v.blocked && (
        <div style={{ marginTop: 10 }}>
          <label className="field-label">Reason (shown when booking)</label>
          <input className="input" value={v.blockReason} onChange={(e) => setV({ ...v, blockReason: e.target.value })} placeholder="e.g. damaged room, chargeback" />
        </div>
      )}

      <div className="row" style={{ gap: 10, marginTop: 16 }}>
        <button onClick={save} disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save guest"}</button>
        {saved && <span style={{ fontSize: 13, color: "var(--good-700)" }}>Saved ✓</span>}
      </div>
    </div>
  );
}
