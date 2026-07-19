"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Icon } from "@/components/ui";
import { displayINR } from "@/lib/format";
import { todayDateOnly } from "@/lib/dates";
import type { ChannelRecon } from "@/lib/finance";

// OTA payout reconciliation (GAP-13/US-405). Per OTA-collect channel: owed (Σ net)
// vs received (Σ recorded payouts). Variance is derived on the server — this panel
// only records the settlements and shows the result.
export function PayoutsPanel({ recon, channels }: { recon: ChannelRecon[]; channels: { id: string; name: string }[] }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ channelId: channels[0]?.id ?? "", amount: "", paidAt: todayDateOnly(), reference: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/payouts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channelId: f.channelId,
        amount: Number(f.amount),
        paidAt: f.paidAt,
        reference: f.reference || undefined,
        note: f.note || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save payout.");
      return;
    }
    setF({ channelId: channels[0]?.id ?? "", amount: "", paidAt: todayDateOnly(), reference: "", note: "" });
    setAdding(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Delete payout", message: "Delete this recorded payout?", danger: true, confirmLabel: "Delete" }))) return;
    await fetch(`/api/payouts/${id}`, { method: "DELETE" });
    router.refresh();
  }

  // Nothing to reconcile and no OTA-collect channels configured → hide entirely.
  if (recon.length === 0 && channels.length === 0) return null;

  return (
    <section>
      <div className="row" style={{ justifyContent: "space-between", margin: "28px 0 6px" }}>
        <span style={{ fontWeight: 700, fontSize: "var(--fs-h3)" }}>OTA payouts</span>
        {channels.length > 0 && (
          <button onClick={() => { setAdding(!adding); setError(null); }} className="btn btn--ghost btn--sm">+ Record payout</button>
        )}
      </div>
      <p style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)", margin: "0 0 14px" }}>
        All-time: what each OTA owes you (net of commission) vs what it has actually paid.
      </p>

      {adding && (
        <form onSubmit={add} className="card" style={{ padding: 16, marginBottom: 12 }}>
          {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", margin: "0 0 10px" }}>{error}</p>}
          <div className="form-grid" style={{ gap: 12 }}>
            <div>
              <label className="field-label">OTA</label>
              <select className="select" value={f.channelId} onChange={(e) => setF({ ...f, channelId: e.target.value })}>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Amount received (₹)</label>
              <input className="input" type="number" min="1" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" />
            </div>
            <div>
              <label className="field-label">Settlement date</label>
              <input className="input" type="date" required value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Reference</label>
              <input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="statement / transfer id" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Note</label>
              <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="optional" />
            </div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={busy || !f.channelId} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Record payout"}</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
        </form>
      )}

      {recon.length === 0 ? (
        <div className="empty">No OTA-collect bookings yet.</div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {recon.map((c) => {
            const settled = Math.abs(c.variance) < 1;
            const varColor = settled ? "var(--text-subtle)" : c.variance > 0 ? "var(--amber-text)" : "var(--red-text)";
            const varLabel = settled ? "settled" : c.variance > 0 ? "still owed" : "overpaid";
            return (
              <div key={c.channelId} className="card" style={{ padding: "13px 15px" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "var(--fs-body)" }}>{c.channel}</div>
                    <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)", marginTop: 2 }}>
                      {c.bookings} booking{c.bookings === 1 ? "" : "s"} · owed {displayINR(c.owed)} · received {displayINR(c.received)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="num" style={{ fontWeight: 700, color: varColor }}>{displayINR(Math.abs(c.variance))}</div>
                    <div style={{ fontSize: "var(--fs-meta)", color: varColor }}>{varLabel}</div>
                  </div>
                </div>
                {c.payouts.length > 0 && (
                  <>
                    <button
                      onClick={() => setOpen(open === c.channelId ? null : c.channelId)}
                      className="btn btn--ghost btn--sm"
                      style={{ marginTop: 10, padding: "4px 8px" }}
                    >
                      <Icon name="chevronR" size={14} /> {open === c.channelId ? "Hide" : "Show"} {c.payouts.length} payout{c.payouts.length === 1 ? "" : "s"}
                    </button>
                    {open === c.channelId && (
                      <div className="col" style={{ gap: 8, marginTop: 10 }}>
                        {c.payouts.map((p) => (
                          <div key={p.id} className="row" style={{ gap: 10, alignItems: "center" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "var(--fs-small)", fontWeight: 600 }}>{displayINR(p.amount)} <span style={{ color: "var(--text-subtle)", fontWeight: 400 }}>· {p.paidAt}</span></div>
                              {(p.reference || p.note) && (
                                <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)" }}>{[p.reference, p.note].filter(Boolean).join(" · ")}</div>
                              )}
                            </div>
                            <button onClick={() => remove(p.id)} className="btn btn--ghost btn--sm" aria-label="Delete payout" style={{ flex: "none", padding: "6px 8px" }}>
                              <Icon name="x" size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
