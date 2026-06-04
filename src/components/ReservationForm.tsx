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

// Solid channel dots (match the calendar grid palette).
const CH_DOT: Record<string, string> = {
  Direct: "#0f766e",
  WhatsApp: "#16a34a",
  "Booking.com": "#2563eb",
  Agoda: "#e11d48",
  MakeMyTrip: "#ea580c",
};

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut || checkOut <= checkIn) return 0;
  return Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
}

export function ReservationForm({ mode, rooms, channels, initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  // null = dates incomplete (availability unknown → all rooms enabled).
  const [freeMap, setFreeMap] = useState<Record<string, boolean> | null>(null);

  function set<K extends keyof ReservationFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const { roomId, checkIn, checkOut } = values;
  const nights = nightsBetween(checkIn, checkOut);

  // Error prevention: which rooms are actually free for these dates? Disable the
  // rest so an overlapping booking can't be picked. Edit mode ignores self.
  useEffect(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setFreeMap(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const ex = mode === "edit" && values.id ? `&exclude=${values.id}` : "";
        const res = await fetch(`/api/rooms/available?checkIn=${checkIn}&checkOut=${checkOut}${ex}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) return setFreeMap(null);
        const map: Record<string, boolean> = {};
        for (const r of json.data as { id: string; free: boolean }[]) map[r.id] = r.free;
        setFreeMap(map);
        // If the selected room just became unavailable, drop it.
        setValues((v) => (v.roomId && map[v.roomId] === false ? { ...v, roomId: "" } : v));
      } catch {
        /* aborted */
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [checkIn, checkOut, mode, values.id]);

  // Advisory pricing: pre-fill the amount if the owner hasn't typed one.
  useEffect(() => {
    if (!roomId || !checkIn || !checkOut || checkOut <= checkIn) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pricing/quote?roomId=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) return setQuote(null);
        setQuote(json.data);
        setValues((v) => (v.grossAmount.trim() === "" ? { ...v, grossAmount: String(json.data.total) } : v));
      } catch {
        /* aborted */
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [roomId, checkIn, checkOut]);

  // Blacklist check (create only, advisory).
  const [blockedWarn, setBlockedWarn] = useState<string | null>(null);
  const phone = values.guestPhone.trim();
  useEffect(() => {
    if (mode !== "create" || phone.length < 4) {
      setBlockedWarn(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/guests?q=${encodeURIComponent(phone)}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) return;
        const match = (json.data as { phone: string; blocked: boolean; blockReason: string | null }[]).find((g) => g.phone === phone && g.blocked);
        setBlockedWarn(match ? match.blockReason || "This guest is blacklisted." : null);
      } catch {
        /* aborted */
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [mode, phone]);

  const adjustments = quote
    ? [...new Set(quote.nights.flatMap((n) => n.applied))].filter((a) => a !== "Clamped to floor/ceiling")
    : [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.roomId) return setError("Pick a room for these dates.");
    if (!values.channelId) return setError("Choose a booking channel.");
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
    <form onSubmit={onSubmit}>
      {error && (
        <div className="banner banner--danger" style={{ marginBottom: 14 }}>
          <span className="banner__icon"><Icon name="alert" size={18} /></span>
          <span className="banner__txt">{error}</span>
        </div>
      )}
      {blockedWarn && (
        <div className="banner banner--warn" style={{ marginBottom: 14 }}>
          <span className="banner__icon"><Icon name="alert" size={18} /></span>
          <span className="banner__txt"><b>Blacklisted guest:</b> {blockedWarn}</span>
        </div>
      )}

      {/* ---------- Guest ---------- */}
      <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Guest</div>
      <div className="card card--pad" style={{ marginBottom: 18 }}>
        {mode === "create" ? (
          <>
            <div className="field">
              <label className="field-label">Phone <span className="req">*</span></label>
              <input className="input" required value={values.guestPhone} onChange={(e) => set("guestPhone", e.target.value)} placeholder="98xxxxxxxx" inputMode="tel" />
              <div className="field-hint">We’ll match an existing guest as you type.</div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Full name <span className="req">*</span></label>
              <input className="input" required value={values.guestName} onChange={(e) => set("guestName", e.target.value)} placeholder="e.g. Priya Nair" />
            </div>
          </>
        ) : (
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Guest</label>
            <div style={{ fontWeight: 600, color: "var(--ink)" }}>{values.guestName}</div>
            <div className="field-hint">{values.guestPhone}</div>
          </div>
        )}
      </div>

      {/* ---------- Stay ---------- */}
      <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Stay</div>
      <div className="card card--pad" style={{ marginBottom: 18 }}>
        <div className="form-grid">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Check-in</label>
            <input className="input" type="date" required value={values.checkIn} onChange={(e) => set("checkIn", e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Check-out</label>
            <input className="input" type="date" required value={values.checkOut} onChange={(e) => set("checkOut", e.target.value)} />
          </div>
        </div>
        <div className="field-hint" style={{ marginBottom: 14 }}>{nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "Pick check-in and check-out"}</div>

        <label className="field-label">Room <span className="req">*</span></label>
        <div className="chips">
          {rooms.map((r) => {
            const free = freeMap ? freeMap[r.id] !== false : true;
            const selected = values.roomId === r.id && free;
            return (
              <button type="button" key={r.id} className={`chip${selected ? " on" : ""}`} disabled={!free} onClick={() => free && set("roomId", r.id)}>
                {r.label} <span className="chip__sub">{r.roomTypeName}</span>
              </button>
            );
          })}
        </div>
        <div className="field-hint">
          {freeMap ? "Only rooms free for these dates are selectable — no overlaps possible." : "Pick dates to see which rooms are free."}
        </div>
      </div>

      {/* ---------- Channel ---------- */}
      <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Channel</div>
      <div className="chips" style={{ marginBottom: 18 }}>
        {channels.map((c) => {
          const on = values.channelId === c.id;
          return (
            <button type="button" key={c.id} className={`chip${on ? " on" : ""}`} onClick={() => set("channelId", c.id)}>
              <span className="dot" style={{ background: on ? "#fff" : CH_DOT[c.name] ?? "var(--accent)" }} />{c.name}
            </button>
          );
        })}
      </div>

      {/* ---------- Details ---------- */}
      <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Details</div>
      <div className="card card--pad" style={{ marginBottom: 4 }}>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Arrival time</label>
            <input className="input" type="time" value={values.arrivalTime} onChange={(e) => set("arrivalTime", e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Amount (₹)</label>
            <input className="input num" inputMode="numeric" min="0" value={values.grossAmount} onChange={(e) => set("grossAmount", e.target.value)} placeholder="0" />
          </div>
        </div>

        {quote && quote.nights.length > 0 && (
          <div className="card" style={{ padding: "10px 12px", background: "var(--accent-bg)", borderColor: "transparent", marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: "var(--fs-small)" }}>
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>Suggested ₹{quote.total.toLocaleString("en-IN")}</span>
                <span className="muted"> · {quote.nights.length} night{quote.nights.length === 1 ? "" : "s"}</span>
                {adjustments.length > 0 && <span className="muted"> · {adjustments.join(", ")}</span>}
              </div>
              {String(quote.total) !== values.grossAmount.trim() && (
                <button type="button" onClick={() => set("grossAmount", String(quote.total))} className="btn btn--ghost btn--sm" style={{ flex: "none" }}>Use</button>
              )}
            </div>
          </div>
        )}

        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Special requests</label>
          <textarea className="textarea" value={values.specialRequests} onChange={(e) => set("specialRequests", e.target.value)} placeholder="Dietary needs, late arrival, extra bed…" />
        </div>
      </div>

      <div className="form-save">
        <button type="submit" disabled={saving} className="btn btn--primary btn--block">
          <Icon name="check" size={18} /> {saving ? "Saving…" : mode === "create" ? "Save booking" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
