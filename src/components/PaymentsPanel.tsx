"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { displayINR, PAYMENT_MODE_LABELS } from "@/lib/format";
import { rupeesToPaise, paiseToRupees } from "@/lib/money";
import { Icon } from "@/components/ui";
import { buildUpiLink, upiQrSvg } from "@/lib/upi";

export type PaymentRow = {
  id: string;
  amount: number;
  mode: string;
  isAdvance: boolean;
  paidAt: string;
  note: string | null;
};

const MODES = ["cash", "upi", "card", "bank", "ota_collect"] as const;

// Checklist items shown before recording a UPI or bank transfer payment.
// Prevents the owner from accepting fake/edited screenshots.
const VERIFY_ITEMS = [
  "Confirmed receipt in bank / UPI app (not just a screenshot)",
  "Sender name matches the guest's name",
  "Amount is exactly correct",
  "UTR / transaction reference noted in the field below",
];

export function PaymentsPanel({
  reservationId,
  gross,
  advanceRequired,
  payments,
  upi,
}: {
  reservationId: string;
  gross: number;
  advanceRequired: number;
  payments: PaymentRow[];
  upi?: { vpa: string; payeeName: string };
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<string>("cash");
  const [isAdvance, setIsAdvance] = useState(false);
  const [note, setNote] = useState("");
  const [checklist, setChecklist] = useState<boolean[]>(VERIFY_ITEMS.map(() => false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const needsVerify = mode === "upi" || mode === "bank";
  const allChecked = checklist.every(Boolean);
  const canAdd = !needsVerify || allChecked;

  function toggleCheck(i: number) {
    setChecklist((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function changeMode(m: string) {
    setMode(m);
    setChecklist(VERIFY_ITEMS.map(() => false));
  }

  const collected = payments.reduce((s, p) => s + p.amount, 0);
  const advancePaid = payments.filter((p) => p.isAdvance).reduce((s, p) => s + p.amount, 0);
  const balance = gross - collected;
  const pct = gross > 0 ? Math.min(100, (collected / gross) * 100) : 0;
  // Self-contained SVG QR of the UPI link for the outstanding balance. Memoised so
  // typing in the amount field doesn't re-encode it on every keystroke.
  const qrSvg = useMemo(
    () => (upi && balance > 0 ? upiQrSvg({ vpa: upi.vpa, payeeName: upi.payeeName, amount: paiseToRupees(balance), note: "Booking payment" }) : ""),
    [upi, balance],
  );
  const advanceOk = advanceRequired > 0 && advancePaid >= advanceRequired;
  const advancePending = advanceRequired > 0 && !advanceOk;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: rupeesToPaise(Number(amount)), // field is rupees; API is paise (GAP-9)
          mode,
          isAdvance,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not add payment.");
        return;
      }
      setAmount("");
      setNote("");
      setIsAdvance(false);
      setChecklist(VERIFY_ITEMS.map(() => false));
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
        {/* Advance status row — only shown when an advance is configured */}
        {advanceRequired > 0 && (
          <div
            className="spread"
            style={{
              padding: "8px 10px",
              borderRadius: 7,
              marginBottom: 10,
              background: advanceOk ? "var(--good-fill, #f0fdf4)" : "var(--warn-fill, #fffbeb)",
              fontSize: "var(--fs-small)",
            }}
          >
            <span style={{ color: advanceOk ? "var(--good-text, #15803d)" : "var(--warn-text, #b45309)", fontWeight: 600 }}>
              {advanceOk ? "Advance received ✓" : "Advance pending"}
            </span>
            <span className="muted">
              {displayINR(advancePaid)} / {displayINR(advanceRequired)} required
            </span>
          </div>
        )}

        <div className="spread" style={{ marginBottom: 7, fontSize: "var(--fs-meta)" }}>
          <span className="muted">Collected {displayINR(collected)} of {displayINR(gross)}</span>
          <span className="money">{Math.round(pct)}%</span>
        </div>
        <div className="progress" style={{ marginBottom: 14 }}>
          <div className={`progress__fill${balance > 0 ? " progress__fill--warn" : ""}`} style={{ width: `${pct}%` }} />
        </div>

        {/* UPI request for the outstanding balance (no SDK — standard UPI URL).
            The link is a tap-to-pay deep link (for the guest's own phone / a
            WhatsApp send); the QR is for showing a guest in person or screenshotting. */}
        {upi && balance > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="row" style={{ gap: 8 }}>
              <a
                className="btn btn--ghost"
                style={{ flex: 1 }}
                href={buildUpiLink({ vpa: upi.vpa, payeeName: upi.payeeName, amount: paiseToRupees(balance), note: "Booking payment" })}
              >
                <Icon name="wallet" size={16} /> Request {displayINR(balance)} via UPI
              </a>
              <button type="button" className="btn btn--ghost" style={{ flex: "none" }} onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
                {showQr ? "Hide QR" : "Show QR"}
              </button>
            </div>
            {showQr && (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <div
                  style={{ width: 200, maxWidth: "60%", margin: "0 auto", background: "#fff", padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)" }}
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 6 }}>
                  Scan with any UPI app to pay {displayINR(balance)} to {upi.vpa}
                </div>
              </div>
            )}
          </div>
        )}

        {payments.map((p, i) => (
          <div key={p.id} className="spread" style={{ padding: "8px 0", borderTop: i ? "1px solid var(--border-subtle)" : 0 }}>
            <span style={{ fontSize: "var(--fs-small)" }}>
              <b className="num" style={{ color: "var(--ink)" }}>{displayINR(p.amount)}</b>
              {" · "}{PAYMENT_MODE_LABELS[p.mode] ?? p.mode}
              {p.isAdvance && <span className="badge badge--paid" style={{ marginLeft: 6 }}>Advance</span>}
              {p.note && <span className="muted"> · {p.note}</span>}
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

        <form onSubmit={add} style={{ marginTop: 14 }}>
          <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
            <input className="input" inputMode="numeric" min="1" required placeholder="Amount" aria-label="Payment amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 1 }} />
            <select className="select" value={mode} onChange={(e) => changeMode(e.target.value)} aria-label="Payment method" style={{ width: 140, flex: "none" }}>
              {MODES.map((m) => (
                <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>
              ))}
            </select>
          </div>

          {/* Mark as advance checkbox */}
          {advancePending && (
            <label className="row" style={{ gap: 8, fontSize: "var(--fs-small)", cursor: "pointer", marginTop: 8 }}>
              <input type="checkbox" checked={isAdvance} onChange={(e) => setIsAdvance(e.target.checked)} />
              <span>Mark as advance deposit</span>
            </label>
          )}

          {/* UTR / reference field for UPI and bank transfers */}
          {needsVerify && (
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="UTR / transaction reference (e.g. 408912345678)"
              aria-label="UTR / transaction reference"
              style={{ marginTop: 8 }}
            />
          )}

          {/* Verification checklist — prevents accepting fake screenshots */}
          {needsVerify && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--warn-fill, #fffbeb)", borderRadius: 8, border: "1px solid var(--warn-text, #b45309)" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--fs-small)", color: "var(--warn-text, #b45309)", marginBottom: 8 }}>
                Verify before recording
              </div>
              {VERIFY_ITEMS.map((item, i) => (
                <label key={i} className="row" style={{ gap: 8, fontSize: "var(--fs-small)", cursor: "pointer", marginBottom: i < VERIFY_ITEMS.length - 1 ? 6 : 0 }}>
                  <input
                    type="checkbox"
                    checked={checklist[i]}
                    onChange={() => toggleCheck(i)}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <span style={{ color: checklist[i] ? "var(--text-subtle)" : "var(--ink)" }}>{item}</span>
                </label>
              ))}
            </div>
          )}

          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button type="submit" disabled={busy || !canAdd} className="btn btn--ghost" style={{ flex: "none" }}>
              {busy ? "…" : "Add payment"}
            </button>
            {needsVerify && !allChecked && (
              <span style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)", alignSelf: "center" }}>
                Tick all items above to enable
              </span>
            )}
          </div>
        </form>
        {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  );
}
