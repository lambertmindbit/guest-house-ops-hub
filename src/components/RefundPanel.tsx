"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { displayINR } from "@/lib/format";
import { rupeesToPaise, paiseToRupees } from "@/lib/money";
import { useConfirm } from "@/components/ConfirmProvider";

export type RefundRow = {
  id: string;
  amount: number;
  status: "requested" | "approved" | "partial" | "rejected";
  reason: string | null;
  approvedAt: string | null;
  createdAt: string;
};

const STATUS_CLS: Record<RefundRow["status"], string> = {
  requested: "badge--warn",
  approved: "badge--good",
  partial: "badge--paid",
  rejected: "badge--neutral",
};

export function RefundPanel({
  reservationId,
  collected,
  suggestedRefund,
  refundPct,
  daysUntilCheckIn,
  refunds,
}: {
  reservationId: string;
  collected: number;
  suggestedRefund: number;
  refundPct: number;
  daysUntilCheckIn: number;
  refunds: RefundRow[];
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  // suggestedRefund is paise; the field holds rupees.
  const [amount, setAmount] = useState(String(paiseToRupees(suggestedRefund)));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reservations/${reservationId}/refunds`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: rupeesToPaise(Number(amount)), reason: reason.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not record the refund.");
      return;
    }
    setReason("");
    router.refresh();
  }

  async function transition(id: string, status: RefundRow["status"]) {
    await fetch(`/api/refunds/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Delete refund", message: "Remove this refund record?", danger: true, confirmLabel: "Delete" }))) return;
    await fetch(`/api/refunds/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card card--pad" style={{ marginTop: 16 }}>
      <div className="spread" style={{ marginBottom: 6 }}>
        <span className="h3">Cancellation &amp; refund</span>
        <span className={`badge ${refundPct >= 100 ? "badge--good" : refundPct > 0 ? "badge--warn" : "badge--neutral"}`}>
          {refundPct}% refund per policy
        </span>
      </div>
      <p className="help-a" style={{ marginTop: 0 }}>
        Cancelled <b>{daysUntilCheckIn >= 0 ? `${daysUntilCheckIn} day${daysUntilCheckIn === 1 ? "" : "s"} before check-in` : "after check-in"}</b>{" "}
        → policy allows <b>{refundPct}%</b>. Collected <b className="num">{displayINR(collected)}</b> · suggested refund{" "}
        <b className="num">{displayINR(suggestedRefund)}</b>.
      </p>

      {refunds.length > 0 && (
        <div className="col" style={{ gap: 8, margin: "6px 0 12px" }}>
          {refunds.map((r) => (
            <div key={r.id} className="spread" style={{ padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "var(--fs-small)" }}>
                <b className="num" style={{ color: "var(--ink)" }}>{displayINR(r.amount)}</b>
                {" "}<span className={`badge ${STATUS_CLS[r.status]}`}>{r.status}</span>
                {r.reason && <span className="muted"> · {r.reason}</span>}
              </span>
              <span className="row" style={{ gap: 6 }}>
                {r.status === "requested" && (
                  <>
                    <button className="btn btn--success btn--sm" onClick={() => transition(r.id, "approved")}>Approve</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => transition(r.id, "partial")}>Partial</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => transition(r.id, "rejected")}>Reject</button>
                  </>
                )}
                <button className="btn btn--quiet btn--icon btn--sm" onClick={() => remove(r.id)} aria-label="Delete refund">✕</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
        <input className="input" inputMode="numeric" placeholder="Refund amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 1 }} />
        <input className="input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 2 }} />
        <button className="btn btn--primary btn--sm" onClick={record} disabled={busy} style={{ flex: "none" }}>{busy ? "…" : "Record"}</button>
      </div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
