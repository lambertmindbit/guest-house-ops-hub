"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

type Quote = { total: number; nights: { date: string; rate: number; applied: string[] }[] };

export type RoomOption = { id: string; label: string; roomTypeName: string };
export type ChannelOption = { id: string; name: string };
export type AgentOption = { id: string; name: string; commissionPct: number };

export type ReservationFormValues = {
  id?: string;
  version?: number;
  roomId: string;
  channelId: string;
  agentId: string;
  checkIn: string;
  checkOut: string;
  arrivalTime: string;
  specialRequests: string;
  grossAmount: string;
  advanceRequired: string;
  guestName: string;
  guestPhone: string;
};

type Props = {
  mode: "create" | "edit";
  rooms: RoomOption[];
  channels: ChannelOption[];
  agents?: AgentOption[];
  initial: ReservationFormValues;
  idPolicy?: "off" | "warn" | "block";
  idRequiredAtBooking?: boolean;
  // Rooms currently needing cleaning + the property's "today" (GAP-20 warn-on-book).
  dirtyRoomIds?: string[];
  today?: string;
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

export function ReservationForm({ mode, rooms, channels, agents = [], initial, idPolicy = "block", idRequiredAtBooking = false, dirtyRoomIds = [], today = "" }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  // null = dates incomplete (availability unknown → all rooms enabled).
  const [freeMap, setFreeMap] = useState<Record<string, boolean> | null>(null);
  // C-Form (foreign-national registration) — create mode, toggle-gated. Persisted
  // to the upserted guest via the existing PATCH /api/guests/[id] (no API change).
  const [showCform, setShowCform] = useState(false);
  const [cform, setCform] = useState({ nationality: "", passportNumber: "", arrivalInIndia: "", portOfEntry: "", purposeOfVisit: "" });
  function setCf(key: keyof typeof cform, value: string) {
    setCform((c) => ({ ...c, [key]: value }));
  }
  // Booking-time acknowledgement that a valid ID will be collected at check-in.
  const [idAck, setIdAck] = useState(false);
  const [idNumber, setIdNumber] = useState("");
  const ackNeeded = mode === "create" && idPolicy !== "off";

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

  // Blacklist + scam-number check (create only, advisory).
  const [blockedWarn, setBlockedWarn] = useState<string | null>(null);
  const [scamWarn, setScamWarn] = useState<string | null>(null);
  const phone = values.guestPhone.trim();
  useEffect(() => {
    if (mode !== "create" || phone.length < 4) {
      setBlockedWarn(null);
      setScamWarn(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const [guestRes, scamRes] = await Promise.all([
          fetch(`/api/guests?q=${encodeURIComponent(phone)}`, { signal: ctrl.signal }),
          fetch(`/api/flagged-numbers?check=${encodeURIComponent(phone)}`, { signal: ctrl.signal }),
        ]);
        if (guestRes.ok) {
          const json = await guestRes.json();
          const match = (json.data as { phone: string; blocked: boolean; blockReason: string | null }[]).find((g) => g.phone === phone && g.blocked);
          setBlockedWarn(match ? match.blockReason || "This guest is blacklisted." : null);
        }
        if (scamRes.ok) {
          const sj = await scamRes.json();
          setScamWarn(sj.data.flagged ? sj.data.reason || "This number is on your scam list." : null);
        }
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

  // Advisory only (GAP-20): booking a room that still needs cleaning for a guest
  // arriving today. Never blocks — it's a nudge to get the room ready in time.
  const dirtyArrivalWarn = mode === "create" && !!roomId && checkIn === today && dirtyRoomIds.includes(roomId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.roomId) return setError("Pick a room for these dates.");
    if (!values.channelId) return setError("Choose a booking channel.");
    if (mode === "create" && scamWarn) return setError("This number is on your scam list — resolve before saving.");
    if (mode === "create" && idRequiredAtBooking && !idNumber.trim()) return setError("Enter the guest's ID number to take this booking.");
    if (ackNeeded && !idAck) return setError("Please confirm the guest accepts that a valid ID will be collected at check-in.");
    setSaving(true);
    try {
      const amount = values.grossAmount.trim();
      const advance = values.advanceRequired.trim();
      const common = {
        roomId: values.roomId,
        channelId: values.channelId,
        checkIn: values.checkIn,
        checkOut: values.checkOut,
        arrivalTime: values.arrivalTime || undefined,
        specialRequests: values.specialRequests || undefined,
        grossAmount: amount ? Number(amount) : undefined,
        advanceRequired: advance ? Number(advance) : undefined,
      };

      const res =
        mode === "create"
          ? await fetch("/api/reservations", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...common, agentId: values.agentId || undefined, guest: { name: values.guestName, phone: values.guestPhone, idNumber: idNumber.trim() || undefined }, idAck }),
            })
          : await fetch(`/api/reservations/${values.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              // null (not undefined) so clearing the agent on an edit persists.
              body: JSON.stringify({ ...common, agentId: values.agentId || null, expectedVersion: values.version }),
            });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        return;
      }
      const id = mode === "create" ? json.data.id : values.id;
      // Persist C-Form to the (upserted) guest via the existing guest API.
      if (mode === "create" && showCform && json.data?.guest?.id) {
        const payload: Record<string, string | null> = {};
        for (const [k, v] of Object.entries(cform)) payload[k] = v.trim() ? v.trim() : null;
        await fetch(`/api/guests/${json.data.guest.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
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
      {/* A blacklisted guest is now auto-added to the scam list, so the scam
          banner (which blocks Save) supersedes this advisory one — show only one. */}
      {blockedWarn && !scamWarn && (
        <div className="banner banner--danger" style={{ marginBottom: 14 }}>
          <span className="banner__icon"><Icon name="alert" size={18} /></span>
          <span className="banner__txt"><b>Blacklisted guest:</b> {blockedWarn}</span>
        </div>
      )}
      {scamWarn && (
        <div className="banner banner--danger" style={{ marginBottom: 14 }}>
          <span className="banner__icon"><Icon name="alert" size={18} /></span>
          <span className="banner__txt"><b>Scam list:</b> {scamWarn} — saving is blocked until you resolve this.</span>
        </div>
      )}
      {dirtyArrivalWarn && (
        <div className="banner banner--warn" style={{ marginBottom: 14 }}>
          <span className="banner__icon"><Icon name="alert" size={18} /></span>
          <span className="banner__txt"><b>Room needs cleaning</b> — this guest is arriving today. You can still book; just make sure it&apos;s ready in time.</span>
        </div>
      )}

      {/* ---------- Guest ---------- */}
      <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Guest</div>
      <div className="card card--pad" style={{ marginBottom: 18 }}>
        {mode === "create" ? (
          <>
            <div className="field">
              <label className="field-label">Phone <span className="req">*</span></label>
              <input className="input" required value={values.guestPhone} onChange={(e) => set("guestPhone", e.target.value)} placeholder="98xxxxxxxx" inputMode="tel" aria-label="Guest phone" />
              <div className="field-hint">We’ll match an existing guest as you type.</div>
            </div>
            <div className="field">
              <label className="field-label">Full name <span className="req">*</span></label>
              <input className="input" required value={values.guestName} onChange={(e) => set("guestName", e.target.value)} placeholder="e.g. Priya Nair" aria-label="Guest full name" />
            </div>

            {/* C-Form: collect foreign-national registration at booking time. */}
            <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="field-label" style={{ marginBottom: 2 }}>Foreign-national (C-Form)</div>
                <div className="field-hint" style={{ margin: 0 }}>Collect passport & entry details for registration.</div>
              </div>
              <button type="button" className={`switch${showCform ? " on" : ""}`} onClick={() => setShowCform((s) => !s)} aria-label="Collect C-Form details"><span /></button>
            </div>
            {showCform && (
              <div className="form-grid" style={{ marginTop: 14 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field-label">Nationality</label>
                  <input className="input" value={cform.nationality} onChange={(e) => setCf("nationality", e.target.value)} placeholder="e.g. British" />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field-label">Passport no.</label>
                  <input className="input" value={cform.passportNumber} onChange={(e) => setCf("passportNumber", e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field-label">Date of entry</label>
                  <input className="input" type="date" value={cform.arrivalInIndia} onChange={(e) => setCf("arrivalInIndia", e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field-label">Port of entry</label>
                  <input className="input" value={cform.portOfEntry} onChange={(e) => setCf("portOfEntry", e.target.value)} placeholder="e.g. Delhi (DEL)" />
                </div>
                <div className="field" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
                  <label className="field-label">Purpose of visit</label>
                  <input className="input" value={cform.purposeOfVisit} onChange={(e) => setCf("purposeOfVisit", e.target.value)} placeholder="Tourism, business…" />
                </div>
              </div>
            )}
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

      {/* ---------- Travel agent (optional) — only if any agents exist ---------- */}
      {agents.length > 0 && (
        <>
          <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Travel agent <span className="muted" style={{ textTransform: "none", letterSpacing: 0 }}>· optional</span></div>
          <div className="chips" style={{ marginBottom: 18 }}>
            {agents.map((a) => {
              const on = values.agentId === a.id;
              // Click the active agent to clear it (a booking need not have one).
              return (
                <button type="button" key={a.id} className={`chip${on ? " on" : ""}`} onClick={() => set("agentId", on ? "" : a.id)}>
                  {a.name} · {a.commissionPct}%
                </button>
              );
            })}
          </div>
        </>
      )}

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
          <div className="field">
            <label className="field-label">Advance required (₹)</label>
            <input className="input num" inputMode="numeric" min="0" value={values.advanceRequired} onChange={(e) => set("advanceRequired", e.target.value)} placeholder="0 = no advance" />
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

      {mode === "create" && idRequiredAtBooking && (
        <div className="card card--pad" style={{ marginBottom: 4 }}>
          <label className="field-label">Guest ID number <span className="req">*</span></label>
          <input className="input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="Passport / Aadhaar / driving licence…" />
          <div className="field-hint">This property requires an ID to take a booking.</div>
        </div>
      )}

      {ackNeeded && (
        <div className="card card--pad" style={{ marginBottom: 4, borderColor: "var(--warn-border, var(--border))" }}>
          <label className="row" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
            <input type="checkbox" checked={idAck} onChange={(e) => setIdAck(e.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: "var(--fs-small)" }}>
              <b>A valid government ID is required.</b> I confirm the guest has been told
              their ID (passport / Aadhaar / etc.) will be <b>collected and recorded at
              check-in</b>. The guest cannot be checked in until it is.
            </span>
          </label>
        </div>
      )}

      <div className="form-save">
        <button type="submit" disabled={saving || (mode === "create" && (!!scamWarn || (ackNeeded && !idAck) || (idRequiredAtBooking && !idNumber.trim())))} className="btn btn--primary btn--block">
          <Icon name="check" size={18} /> {saving ? "Saving…" : mode === "create" ? "Save booking" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
