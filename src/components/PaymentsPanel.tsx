"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { displayINR, PAYMENT_MODE_LABELS } from "@/lib/format";

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
    <section className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-neutral-700">Payments</h2>

      <div className="mb-3 flex justify-between text-sm">
        <span className="text-neutral-500">Collected</span>
        <span className="font-medium">
          {displayINR(collected)} / {displayINR(gross)}
        </span>
      </div>
      <div
        className={`mb-3 flex justify-between rounded-md p-2 text-sm font-medium ${
          balance > 0 ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"
        }`}
      >
        <span>{balance > 0 ? "Balance due" : "Fully paid"}</span>
        <span>{displayINR(Math.max(balance, 0))}</span>
      </div>

      {payments.length > 0 && (
        <ul className="mb-3 space-y-1">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {displayINR(p.amount)}{" "}
                <span className="text-neutral-400">
                  · {PAYMENT_MODE_LABELS[p.mode] ?? p.mode} · {p.paidAt.slice(0, 10)}
                </span>
              </span>
              <button
                onClick={() => remove(p.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        {error && <p className="w-full text-sm text-red-700">{error}</p>}
        <input
          type="number"
          min="1"
          required
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_MODE_LABELS[m]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : "Add payment"}
        </button>
      </form>
    </section>
  );
}
