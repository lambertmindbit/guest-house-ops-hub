"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

// Create a guest without a booking — for pre-registering or pre-blacklisting.
export function AddGuest() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", phone: "", email: "", blocked: false, blockReason: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: f.name,
          phone: f.phone,
          email: f.email || null,
          blocked: f.blocked,
          blockReason: f.blocked ? f.blockReason || null : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not add guest.");
        return;
      }
      router.push(`/guests/${json.data.id}`);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
        <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
          <Icon name="plus" size={15} /> Add guest
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card card--pad" style={{ marginTop: 12 }}>
      <div className="h3" style={{ marginBottom: 10 }}>New guest</div>
      {error && (
        <div className="banner banner--danger" style={{ marginBottom: 12 }}>
          <span className="banner__icon"><Icon name="alert" size={18} /></span>
          <span className="banner__txt">{error}</span>
        </div>
      )}
      <div className="form-grid">
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Full name <span className="req">*</span></label>
          <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Priya Nair" />
        </div>
        <div>
          <label className="field-label">Phone <span className="req">*</span></label>
          <input className="input" required inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="98xxxxxxxx" />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Optional" />
        </div>
        <label className="row" style={{ gap: 8, gridColumn: "1 / -1", fontSize: "var(--fs-small)", cursor: "pointer" }}>
          <input type="checkbox" checked={f.blocked} onChange={(e) => setF({ ...f, blocked: e.target.checked })} />
          Blacklist this guest
        </label>
        {f.blocked && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Reason</label>
            <input className="input" value={f.blockReason} onChange={(e) => setF({ ...f, blockReason: e.target.value })} placeholder="Why are they blocked?" />
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Adding…" : "Add guest"}</button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="btn btn--ghost btn--sm">Cancel</button>
      </div>
      <div className="field-hint" style={{ marginTop: 10 }}>Phone must be unique — if they’ve booked before, search for them instead.</div>
    </form>
  );
}
