"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Icon } from "@/components/ui";
import { displayINR, PAYMENT_MODE_LABELS } from "@/lib/format";
import { todayDateOnly } from "@/lib/dates";

export type ExpenseRow = {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string | null;
  paymentMode: string | null;
};

const CATEGORIES = ["utilities", "salaries", "supplies", "maintenance", "marketing", "other"];
const CAT_LABEL: Record<string, string> = {
  utilities: "Utilities",
  salaries: "Salaries",
  supplies: "Supplies",
  maintenance: "Maintenance",
  marketing: "Marketing",
  other: "Other",
};

export function ExpensesPanel({ expenses, total }: { expenses: ExpenseRow[]; total: number }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ date: todayDateOnly(), category: "utilities", amount: "", note: "", paymentMode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: f.date,
        category: f.category,
        amount: Number(f.amount),
        note: f.note || undefined,
        paymentMode: f.paymentMode || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save expense.");
      return;
    }
    setF({ date: todayDateOnly(), category: "utilities", amount: "", note: "", paymentMode: "" });
    setAdding(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Delete expense", message: "Delete this expense?", danger: true, confirmLabel: "Delete" }))) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section>
      <div className="row" style={{ justifyContent: "space-between", margin: "28px 0 14px" }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Expenses</span>
          <span style={{ fontSize: 13, color: "var(--text-subtle)", fontWeight: 600 }}>{displayINR(total)} this period</span>
        </div>
        <button onClick={() => { setAdding(!adding); setError(null); }} className="btn btn--ghost btn--sm">+ Add expense</button>
      </div>

      {adding && (
        <form onSubmit={add} className="card" style={{ padding: 16, marginBottom: 12 }}>
          {error && <p style={{ color: "var(--red-text)", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}
          <div className="form-grid" style={{ gap: 12 }}>
            <div>
              <label className="field-label">Date</label>
              <input className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Category</label>
              <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Amount (₹)</label>
              <input className="input" type="number" min="1" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" />
            </div>
            <div>
              <label className="field-label">Paid via</label>
              <select className="select" value={f.paymentMode} onChange={(e) => setF({ ...f, paymentMode: e.target.value })}>
                <option value="">—</option>
                {Object.entries(PAYMENT_MODE_LABELS).filter(([k]) => k !== "ota_collect").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Note</label>
              <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. June electricity bill" />
            </div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Add expense"}</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
        </form>
      )}

      {expenses.length === 0 ? (
        <div className="empty">No expenses logged for this period.</div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {expenses.map((e) => (
            <div key={e.id} className="card" style={{ padding: "12px 15px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 7 }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{CAT_LABEL[e.category] ?? e.category}</span>
                  {e.note && <span style={{ fontSize: 12.5, color: "var(--text-subtle)" }}>· {e.note}</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 2 }}>
                  {e.date}{e.paymentMode ? ` · ${PAYMENT_MODE_LABELS[e.paymentMode] ?? e.paymentMode}` : ""}
                </div>
              </div>
              <span className="num" style={{ fontWeight: 700, color: "var(--orange-text)" }}>−{displayINR(e.amount)}</span>
              <button onClick={() => remove(e.id)} className="btn btn--ghost btn--sm" aria-label="Delete expense" style={{ flex: "none", padding: "6px 8px" }}>
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
