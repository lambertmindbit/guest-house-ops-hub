"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Policy = { enabled: boolean; freeCancelDaysDefault: number; freeCancelDaysPeak: number };

export function CancellationSection({ initial }: { initial: Policy }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/settings/cancellation", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: v.enabled,
        freeCancelDaysDefault: Number(v.freeCancelDaysDefault),
        freeCancelDaysPeak: Number(v.freeCancelDaysPeak),
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
    <div className="card card--pad">
      <p className="help-a" style={{ marginTop: 0 }}>
        Free cancellation is allowed up to this many days before check-in. A shorter window applies on
        <b> peak</b> dates — a check-in that falls inside a season with a positive rate adjustment.
      </p>

      <div className="spread" style={{ padding: "10px 0" }}>
        <label style={{ fontWeight: 600 }}>Enforce a cancellation policy</label>
        <button type="button" className={`switch${v.enabled ? " on" : ""}`} onClick={() => setV((p) => ({ ...p, enabled: !p.enabled }))} aria-label="Enable policy"><span /></button>
      </div>

      <div className="form-grid" style={{ gap: 12, marginTop: 6 }}>
        <div>
          <label className="field-label">Free cancel — normal (days before check-in)</label>
          <input className="input" type="number" min={0} max={365} value={v.freeCancelDaysDefault}
            onChange={(e) => setV((p) => ({ ...p, freeCancelDaysDefault: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="field-label">Free cancel — peak (days before check-in)</label>
          <input className="input" type="number" min={0} max={365} value={v.freeCancelDaysPeak}
            onChange={(e) => setV((p) => ({ ...p, freeCancelDaysPeak: Number(e.target.value) }))} />
        </div>
      </div>

      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 10 }}>{error}</p>}
      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <button onClick={save} disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save policy"}</button>
        {saved && <span style={{ fontSize: "var(--fs-small)", color: "var(--green-text)" }}>Saved ✓</span>}
      </div>
    </div>
  );
}
