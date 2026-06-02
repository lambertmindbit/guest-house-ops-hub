"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

type Quote = { total: number; nights: { date: string; rate: number; applied: string[] }[] };

export type RoomOption = { id: string; label: string; roomTypeName: string };
export type ChannelOption = { id: string; name: string };

export type ReservationFormValues = {
  id?: string;
  roomId: string;
  channelId: string;
  checkIn: string;
  checkOut: string;
  arrivalTime: string;
  specialRequests: string;
  grossAmount: string;
  guestName: string;
  guestPhone: string;
};

type Props = {
  mode: "create" | "edit";
  rooms: RoomOption[];
  channels: ChannelOption[];
  initial: ReservationFormValues;
};

export function ReservationForm({ mode, rooms, channels, initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  function set<K extends keyof ReservationFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  // Advisory pricing: when room + dates are set, fetch a suggested total and
  // pre-fill the amount if the owner hasn't typed one. Debounced + abortable.
  const { roomId, checkIn, checkOut } = values;
  useEffect(() => {
    if (!roomId || !checkIn || !checkOut || checkOut <= checkIn) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/pricing/quote?roomId=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}`,
          { signal: ctrl.signal },
        );
        const json = await res.json();
        if (!res.ok) return setQuote(null);
        setQuote(json.data);
        // Only auto-fill an empty amount — never clobber what the owner typed.
        setValues((v) => (v.grossAmount.trim() === "" ? { ...v, grossAmount: String(json.data.total) } : v));
      } catch {
        /* aborted — ignore */
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [roomId, checkIn, checkOut]);

  // Distinct applied-adjustment labels across the stay (for a compact summary).
  const adjustments = quote
    ? [...new Set(quote.nights.flatMap((n) => n.applied))].filter((a) => a !== "Clamped to floor/ceiling")
    : [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const amount = values.grossAmount.trim();
      const common = {
        roomId: values.roomId,
        channelId: values.channelId,
        checkIn: values.checkIn,
        checkOut: values.checkOut,
        arrivalTime: values.arrivalTime || undefined,
        specialRequests: values.specialRequests || undefined,
        grossAmount: amount ? Number(amount) : undefined,
      };

      const res =
        mode === "create"
          ? await fetch("/api/reservations", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...common, guest: { name: values.guestName, phone: values.guestPhone } }),
            })
          : await fetch(`/api/reservations/${values.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(common),
            });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        return;
      }
      const id = mode === "create" ? json.data.id : values.id;
      router.push(`/reservations/${id}`);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 18, marginTop: 16 }}>
      {error && (
        <div className="banner banner--danger" style={{ cursor: "default", marginBottom: 14 }}>
          <span className="banner__icon"><Icon name="alert" size={18} /></span>
          <span style={{ flex: 1 }}>{error}</span>
        </div>
      )}

      <div className="form-grid">
        {mode === "create" ? (
          <>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Guest name</label>
              <input className="input" required value={values.guestName} onChange={(e) => set("guestName", e.target.value)} placeholder="e.g. Priya Nair" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Phone</label>
              <input className="input" required value={values.guestPhone} onChange={(e) => set("guestPhone", e.target.value)} placeholder="98xxxxxxxx" />
            </div>
          </>
        ) : (
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Guest</label>
            <div className="input" style={{ background: "var(--sand)", color: "var(--deep-teal)" }}>
              {values.guestName} · {values.guestPhone}
            </div>
          </div>
        )}

        <div>
          <label className="field-label">Channel</label>
          <select className="select" required value={values.channelId} onChange={(e) => set("channelId", e.target.value)}>
            <option value="">Select…</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Room</label>
          <select className="select" required value={values.roomId} onChange={(e) => set("roomId", e.target.value)}>
            <option value="">Select…</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.label} · {r.roomTypeName}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Check-in</label>
          <input className="input" type="date" required value={values.checkIn} onChange={(e) => set("checkIn", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Check-out</label>
          <input className="input" type="date" required value={values.checkOut} onChange={(e) => set("checkOut", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Arrival time</label>
          <input className="input" type="time" value={values.arrivalTime} onChange={(e) => set("arrivalTime", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Amount (₹)</label>
          <input className="input" inputMode="numeric" min="0" value={values.grossAmount} onChange={(e) => set("grossAmount", e.target.value)} placeholder="0" />
        </div>
        {quote && quote.nights.length > 0 && (
          <div style={{ gridColumn: "1 / -1", marginTop: -4 }}>
            <div className="card" style={{ padding: "10px 12px", background: "var(--teal-50)", borderColor: "transparent" }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 700 }}>Suggested ₹{quote.total.toLocaleString("en-IN")}</span>
                  <span style={{ color: "var(--subtle)" }}> · {quote.nights.length} night{quote.nights.length === 1 ? "" : "s"}</span>
                  {adjustments.length > 0 && (
                    <span style={{ color: "var(--subtle)" }}> · {adjustments.join(", ")}</span>
                  )}
                </div>
                {String(quote.total) !== values.grossAmount.trim() && (
                  <button type="button" onClick={() => set("grossAmount", String(quote.total))} className="btn btn--ghost btn--sm" style={{ flex: "none" }}>
                    Use
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Special requests</label>
          <textarea className="textarea" value={values.specialRequests} onChange={(e) => set("specialRequests", e.target.value)} placeholder="Dietary needs, late arrival, extra bed…" />
        </div>
      </div>

      <div style={{ height: 16 }} />
      <button type="submit" disabled={saving} className="btn btn--primary btn--block">
        <Icon name="check" size={18} /> {saving ? "Saving…" : mode === "create" ? "Create booking" : "Save changes"}
      </button>
    </form>
  );
}
