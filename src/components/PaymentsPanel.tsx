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
    <>
      <div className="row" style={{ justifyContent: "space-between", margin: "28px 0 14px" }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>Payments</span>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 13.5, color: "var(--subtle)" }}>Collected</span>
          <span className="num" style={{ fontWeight: 700, fontSize: 16 }}>
            {displayINR(collected)} <span style={{ color: "var(--subtle)", fontWeight: 500 }}>/ {displayINR(gross)}</span>
          </span>
        </div>
        <div style={{ height: 9, borderRadius: 99, background: "var(--sand)", overflow: "hidden", marginBottom: 10 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: balance <= 0 ? "var(--good)" : "var(--clay)", borderRadius: 99, transition: "width .4s var(--ease)" }} />
        </div>
        {balance <= 0 ? (
          <span className="pill pill--good"><Icon name="check" size={14} /> Fully paid</span>
        ) : (
          <span className="pill pill--warn">Balance due {displayINR(balance)}</span>
        )}

        <div className="col" style={{ gap: 8, margin: "14px 0" }}>
          {payments.map((p) => (
            <div key={p.id} className="row" style={{ justifyContent: "space-between", padding: "10px 12px", background: "var(--cream)", borderRadius: 12 }}>
              <span className="num" style={{ fontWeight: 600 }}>{displayINR(p.amount)}</span>
              <span style={{ fontSize: 13, color: "var(--subtle)" }}>
                {PAYMENT_MODE_LABELS[p.mode] ?? p.mode} · {p.paidAt.slice(0, 10)}
              </span>
              <button className="btn btn--ghost btn--sm" style={{ padding: 4 }} onClick={() => remove(p.id)} aria-label="Remove payment">
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
          {payments.length === 0 && <div style={{ fontSize: 13.5, color: "var(--subtle)" }}>No payments recorded yet.</div>}
        </div>

        <form onSubmit={add} className="row" style={{ gap: 8, alignItems: "stretch" }}>
          <input className="input" inputMode="numeric" min="1" required placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 1 }} />
          <select className="select" value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: 130 }}>
            {MODES.map((m) => (
              <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>
            ))}
          </select>
          <button type="submit" disabled={busy} className="btn btn--dark">{busy ? "…" : "Add"}</button>
        </form>
        {error && <p style={{ color: "var(--danger-700)", fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>
    </>
  );
}
