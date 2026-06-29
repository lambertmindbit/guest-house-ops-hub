"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

type FlaggedEntry = { id: string; phone: string; reason: string | null; createdAt: string };

export function FlaggedNumbersSection({ numbers }: { numbers: FlaggedEntry[] }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/flagged-numbers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), reason: reason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not add number.");
        return;
      }
      setPhone("");
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/flagged-numbers/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: "var(--text-subtle)", margin: "0 0 14px" }}>
          Numbers added here trigger a warning banner when a booking is made with that phone number. They also appear on the guest&apos;s profile if they have booked before.
        </p>

        <form onSubmit={add}>
          <div className="form-grid" style={{ gap: 10 }}>
            <div>
              <label className="field-label">Phone number</label>
              <input
                className="input"
                inputMode="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>
            <div>
              <label className="field-label">Reason (optional)</label>
              <input
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Fake UPI screenshot"
              />
            </div>
          </div>
          {error && <p className="field-error" style={{ marginTop: 8 }}>{error}</p>}
          <button type="submit" disabled={busy} className="btn btn--primary btn--sm" style={{ marginTop: 12 }}>
            {busy ? "Adding…" : "Add to scam list"}
          </button>
        </form>
      </div>

      {numbers.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, textAlign: "center", padding: 24 }}>No flagged numbers yet.</p>
      ) : (
        <div className="col" style={{ gap: 1 }}>
          {numbers.map((n) => (
            <div key={n.id} className="card" style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{n.phone}</div>
                {n.reason && <div style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 2 }}>{n.reason}</div>}
              </div>
              <span style={{ fontSize: 12, color: "var(--text-subtle)", flexShrink: 0 }}>{n.createdAt}</span>
              <button
                className="btn btn--quiet btn--icon btn--sm"
                onClick={() => remove(n.id)}
                aria-label="Remove"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
