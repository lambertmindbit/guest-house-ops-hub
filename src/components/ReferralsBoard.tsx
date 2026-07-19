"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReferralView, ReferralAnalytics } from "@/lib/community/referrals";
import { paiseToRupees } from "@/lib/money";

type Peer = { propertyId: string; name: string };
type Balance = { peerPropertyId: string; peerName: string; balance: number };
type Reservation = { id: string; label: string };

const STATUS_CLS: Record<string, string> = {
  proposed: "badge--warn", accepted: "badge--sent", converted: "badge--good", declined: "badge--neutral", expired: "badge--neutral",
};

function money(n: number) {
  // n is paise (GAP-9); referral revenue/balances are stored whole-rupee.
  return `₹${Math.round(paiseToRupees(n)).toLocaleString("en-IN")}`;
}

export function ReferralsBoard({
  referrals, balances, peers, analytics, recentReservations,
}: {
  referrals: ReferralView[];
  balances: Balance[];
  peers: Peer[];
  analytics: ReferralAnalytics;
  recentReservations: Reservation[];
}) {
  const router = useRouter();
  const inbound = referrals.filter((r) => r.direction === "inbound");
  const outbound = referrals.filter((r) => r.direction === "outbound");

  // Send form
  const [to, setTo] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [need, setNeed] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/community/referrals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toPropertyId: to, guestName, guestPhone: guestPhone || undefined, checkIn, checkOut, roomTypeNeed: need || undefined, note: note || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not send the referral.");
      return;
    }
    setTo(""); setGuestName(""); setGuestPhone(""); setCheckIn(""); setCheckOut(""); setNeed(""); setNote("");
    router.refresh();
  }

  async function respond(id: string, action: "accept" | "decline") {
    await fetch(`/api/community/referrals/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    router.refresh();
  }

  async function convert(id: string, reservationId: string) {
    const res = await fetch(`/api/community/referrals/${id}/convert`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reservationId }) });
    if (res.ok) router.refresh();
  }

  return (
    <div>
      {/* Analytics + credit balances */}
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 20, flexWrap: "wrap" }}>
          <div><div className="h3">{analytics.sent}</div><div className="muted" style={{ fontSize: "var(--fs-meta)" }}>Sent</div></div>
          <div><div className="h3">{Math.round(analytics.conversionRate * 100)}%</div><div className="muted" style={{ fontSize: "var(--fs-meta)" }}>Converted</div></div>
          <div><div className="h3">{money(analytics.revenueEarned)}</div><div className="muted" style={{ fontSize: "var(--fs-meta)" }}>Revenue you sent</div></div>
        </div>
        {balances.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <div className="muted" style={{ fontSize: "var(--fs-meta)", marginBottom: 6 }}>Credit balance (positive = they owe you)</div>
            <div className="col" style={{ gap: 4 }}>
              {balances.map((b) => (
                <div key={b.peerPropertyId} className="spread" style={{ fontSize: "var(--fs-small)" }}>
                  <span>{b.peerName}</span>
                  <span className={`badge ${b.balance >= 0 ? "badge--good" : "badge--warn"}`}>{money(b.balance)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Send a referral */}
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="h3" style={{ marginBottom: 10 }}>Refer a guest</div>
        {peers.length === 0 ? (
          <div className="muted" style={{ fontSize: "var(--fs-small)" }}>
            No peers are accepting referrals from you yet. Connect in <Link href="/settings/network">Trusted network</Link> and ask them to enable referral sharing.
          </div>
        ) : (
          <>
            <div className="form-grid" style={{ gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="field-label">Refer to</label>
                <select className="select" value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Choose a property…</option>
                  {peers.map((p) => <option key={p.propertyId} value={p.propertyId}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="field-label">Guest name</label><input className="input" value={guestName} onChange={(e) => setGuestName(e.target.value)} /></div>
              <div><label className="field-label">Guest phone</label><input className="input" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Shared only after they accept" /></div>
              <div><label className="field-label">Check-in</label><input className="input" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></div>
              <div><label className="field-label">Check-out</label><input className="input" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></div>
              <div><label className="field-label">Room need</label><input className="input" value={need} onChange={(e) => setNeed(e.target.value)} placeholder="e.g. double for 2" /></div>
              <div><label className="field-label">Note</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 8 }}>{error}</p>}
            <button className="btn btn--primary btn--sm" style={{ marginTop: 12 }} onClick={send} disabled={busy || !to || !guestName || !checkIn || !checkOut || checkOut <= checkIn}>
              {busy ? "Sending…" : "Send referral"}
            </button>
          </>
        )}
      </div>

      {/* Inbound */}
      <div className="setgroup__label">Incoming referrals</div>
      {inbound.length === 0 ? (
        <div className="empty" style={{ marginBottom: 14 }}>No incoming referrals.</div>
      ) : (
        <div className="col" style={{ gap: 10, marginBottom: 14 }}>
          {inbound.map((r) => <InboundCard key={r.id} r={r} reservations={recentReservations} onRespond={respond} onConvert={convert} />)}
        </div>
      )}

      {/* Outbound */}
      <div className="setgroup__label">Referrals you sent</div>
      {outbound.length === 0 ? (
        <div className="empty">You haven’t sent any referrals yet.</div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {outbound.map((r) => (
            <div key={r.id} className="card card--pad" style={{ padding: 14 }}>
              <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.guestName} → {r.peerName}</div>
                  <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>{r.checkIn} → {r.checkOut}{r.roomTypeNeed ? ` · ${r.roomTypeNeed}` : ""}</div>
                </div>
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  {r.attributedRevenue != null && <span className="muted" style={{ fontSize: "var(--fs-meta)" }}>{money(r.attributedRevenue)}</span>}
                  <span className={`badge ${STATUS_CLS[r.status]}`}>{r.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InboundCard({
  r, reservations, onRespond, onConvert,
}: {
  r: ReferralView;
  reservations: Reservation[];
  onRespond: (id: string, action: "accept" | "decline") => void;
  onConvert: (id: string, reservationId: string) => void;
}) {
  const [reservationId, setReservationId] = useState("");
  return (
    <div className="card card--pad" style={{ padding: 14 }}>
      <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{r.guestName} <span className="muted" style={{ fontWeight: 400 }}>from {r.peerName}</span></div>
          <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>{r.checkIn} → {r.checkOut}{r.roomTypeNeed ? ` · ${r.roomTypeNeed}` : ""}</div>
          {r.guestPhone && <div style={{ fontSize: "var(--fs-small)", marginTop: 4 }}>📞 <a href={`tel:${r.guestPhone}`}>{r.guestPhone}</a></div>}
          {r.note && <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 4 }}>{r.note}</div>}
        </div>
        <span className={`badge ${STATUS_CLS[r.status]}`}>{r.status}</span>
      </div>

      {r.status === "proposed" && (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn btn--primary btn--sm" onClick={() => onRespond(r.id, "accept")}>Accept</button>
          <button className="btn btn--ghost btn--sm" onClick={() => onRespond(r.id, "decline")}>Decline</button>
        </div>
      )}

      {r.status === "accepted" && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <div className="muted" style={{ fontSize: "var(--fs-meta)", marginBottom: 6 }}>
            <Link href="/reservations/new">Book this guest</Link>, then link the booking to attribute the referral:
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <select className="select" style={{ flex: 1, minWidth: 200 }} value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
              <option value="">Select the booking…</option>
              {reservations.map((res) => <option key={res.id} value={res.id}>{res.label}</option>)}
            </select>
            <button className="btn btn--primary btn--sm" onClick={() => onConvert(r.id, reservationId)} disabled={!reservationId}>Link booking</button>
          </div>
        </div>
      )}

      {r.status === "converted" && r.attributedRevenue != null && (
        <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 8 }}>Booked · {money(r.attributedRevenue)} credited to {r.peerName}.</div>
      )}
    </div>
  );
}
