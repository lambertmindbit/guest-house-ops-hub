"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { displayINR, PAYMENT_MODE_LABELS } from "@/lib/format";
import { Icon } from "@/components/ui";

export type PaymentRow = {
  id: string;
  amount: number;
  mode: string;
  paidAt: string;
  note: string | null;
};

const MODES = ["cash", "upi", "card", "bank", "ota_collect"] as const;

export function PaymentsPanel({
  reservationId,
  gross,
  payments,
}: {
  reservationId: string;
  gross: number;
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<string>("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collected = payments.reduce((s, p) => s + p.amount, 0);
  const balance = gross - collected;
  const pct = gross > 0 ? Math.min(100, (collected / gross) * 100) : 0;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), mode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not add payment.");
        return;
      }
      setAmount("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/payments/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-hdr">
        <div className="spread">
          <h3>Payments</h3>
          {balance <= 0 ? (
            <span className="badge badge--paid">Fully paid</span>
          ) : (
            <span className="badge badge--warn">{displayINR(balance)} due</span>
          )}
        </div>
      </div>
      <div className="card-body">
        <div className="spread" style={{ marginBottom: 7, fontSize: "var(--fs-meta)" }}>
          <span className="muted">Collected {displayINR(collected)} of {displayINR(gross)}</span>
          <span className="money">{Math.round(pct)}%</span>
        </div>
        <div className="progress" style={{ marginBottom: 14 }}>
          <div className={`progress__fill${balance > 0 ? " progress__fill--warn" : ""}`} style={{ width: `${pct}%` }} />
        </div>

        {payments.map((p, i) => (
          <div key={p.id} className="spread" style={{ padding: "8px 0", borderTop: i ? "1px solid var(--border-subtle)" : 0 }}>
            <span style={{ fontSize: "var(--fs-small)" }}>
              <b className="num" style={{ color: "var(--ink)" }}>{displayINR(p.amount)}</b> · {PAYMENT_MODE_LABELS[p.mode] ?? p.mode}
            </span>
            <span className="row" style={{ gap: 8 }}>
              <span className="faint" style={{ fontSize: "var(--fs-meta)" }}>{p.paidAt.slice(0, 10)}</span>
              <button className="btn btn--quiet btn--icon btn--sm" onClick={() => remove(p.id)} aria-label="Remove payment">
                <Icon name="x" size={14} />
              </button>
            </span>
          </div>
        ))}
        {payments.length === 0 && <div className="muted" style={{ fontSize: "var(--fs-small)" }}>No payments recorded yet.</div>}

        <form onSubmit={add} className="row" style={{ gap: 8, marginTop: 14, alignItems: "stretch" }}>
          <input className="input" inputMode="numeric" min="1" required placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 1 }} />
          <select className="select" value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: 140, flex: "none" }}>
            {MODES.map((m) => (
              <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>
            ))}
          </select>
          <button type="submit" disabled={busy} className="btn btn--ghost" style={{ flex: "none" }}>{busy ? "…" : "Add"}</button>
        </form>
        {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  );
}
