"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tier = { minDaysBefore: number; refundPct: number };
type Policy = { enabled: boolean; tiers: Tier[] };

// Describe a rung in plain words: the band it covers and what it refunds.
function bandLabel(tiers: Tier[], i: number): string {
  const t = tiers[i];
  const above = i > 0 ? tiers[i - 1].minDaysBefore : null; // next-stricter threshold
  const from = t.minDaysBefore;
  if (above === null) return `${from}+ days before → ${t.refundPct}% refund`;
  const upper = above - 1;
  return upper <= from
    ? `${from} days before → ${t.refundPct}% refund`
    : `${from}–${upper} days before → ${t.refundPct}% refund`;
}

export function CancellationSection({ initial }: { initial: Policy }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [tiers, setTiers] = useState<Tier[]>(
    [...initial.tiers].sort((a, b) => b.minDaysBefore - a.minDaysBefore),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setTier(i: number, patch: Partial<Tier>) {
    setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }
  function addTier() {
    setTiers((ts) => [...ts, { minDaysBefore: 0, refundPct: 0 }]);
  }
  function removeTier(i: number) {
    setTiers((ts) => ts.filter((_, j) => j !== i));
  }

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    const clean = [...tiers].sort((a, b) => b.minDaysBefore - a.minDaysBefore);
    const res = await fetch("/api/settings/cancellation", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled, tiers: clean }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save.");
      return;
    }
    setTiers(clean);
    setSaved(true);
    router.refresh();
  }

  const sorted = [...tiers].sort((a, b) => b.minDaysBefore - a.minDaysBefore);

  return (
    <div className="card card--pad">
      <p className="help-a" style={{ marginTop: 0 }}>
        The refund ladder: cancel at least this many days before check-in and get this share back.
        The <b>highest</b> band that still applies wins; anything below the lowest band gets nothing.
        Refunds stay <b>advisory</b> — the owner can still approve a different amount.
      </p>

      <div className="spread" style={{ padding: "10px 0" }}>
        <label style={{ fontWeight: 600 }}>Enforce a cancellation policy</label>
        <button type="button" className={`switch${enabled ? " on" : ""}`} onClick={() => setEnabled((e) => !e)} aria-label="Enable policy"><span /></button>
      </div>

      <div className="col" style={{ gap: 8, marginTop: 6, opacity: enabled ? 1 : 0.5 }}>
        {sorted.map((t, i) => (
          <div key={i} className="row" style={{ gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              {i === 0 && <label className="field-label">Days before check-in (≥)</label>}
              <input className="input" type="number" min={0} max={365} value={t.minDaysBefore}
                onChange={(e) => setTier(i, { minDaysBefore: Number(e.target.value) })} disabled={!enabled} />
            </div>
            <div style={{ flex: 1 }}>
              {i === 0 && <label className="field-label">Refund %</label>}
              <input className="input" type="number" min={0} max={100} value={t.refundPct}
                onChange={(e) => setTier(i, { refundPct: Number(e.target.value) })} disabled={!enabled} />
            </div>
            <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={() => removeTier(i)} disabled={!enabled} aria-label="Remove band" style={{ marginBottom: 1 }}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn--ghost btn--sm" onClick={addTier} disabled={!enabled} style={{ alignSelf: "flex-start", marginTop: 2 }}>+ Add band</button>
      </div>

      {enabled && sorted.length > 0 && (
        <div className="help-a" style={{ marginTop: 12, fontSize: "var(--fs-small)" }}>
          {sorted.map((_, i) => <div key={i}>{bandLabel(sorted, i)}</div>)}
        </div>
      )}

      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 10 }}>{error}</p>}
      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <button onClick={save} disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save policy"}</button>
        {saved && <span style={{ fontSize: "var(--fs-small)", color: "var(--green-text)" }}>Saved ✓</span>}
      </div>
    </div>
  );
}
