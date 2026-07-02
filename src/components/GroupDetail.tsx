"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { displayINR } from "@/lib/format";

type Child = { id: string; guestName: string; roomLabel: string; dates: string; gross: number | null; collected: number };
type Ungrouped = { id: string; label: string };
type Folio = { gross: number; collected: number; balance: number };

export function GroupDetail({ groupId, bookings, folio, ungrouped }: { groupId: string; bookings: Child[]; folio: Folio; ungrouped: Ungrouped[] }) {
  const router = useRouter();
  const [pick, setPick] = useState("");

  async function attach(reservationId: string, attach: boolean) {
    await fetch(`/api/booking-groups/${groupId}/attach`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reservationId, attach }),
    });
    setPick("");
    router.refresh();
  }

  return (
    <div>
      <div className="kpi-strip kpi-strip--3" style={{ marginBottom: 14 }}>
        <div className="kpi-panel kpi-panel--verdict"><div className="kpi-eyebrow">Folio balance</div><div className="kpi-num">{displayINR(folio.balance)}</div><div className="kpi-ctx">across {bookings.length} booking{bookings.length === 1 ? "" : "s"}</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Gross</div><div className="kpi-num">{displayINR(folio.gross)}</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Collected</div><div className="kpi-num">{displayINR(folio.collected)}</div></div>
      </div>

      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <select className="select" value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
            <option value="">Attach a booking…</option>
            {ungrouped.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <button className="btn btn--primary btn--sm" disabled={!pick} onClick={() => attach(pick, true)}>Attach</button>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="empty">No bookings in this group yet.</div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {bookings.map((c) => (
            <div key={c.id} className="rowcard">
              <Link href={`/reservations/${c.id}`} className="rowcard__main" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="rowcard__name">{c.guestName} · Room {c.roomLabel}</div>
                <div className="rowcard__meta">{c.dates} · {displayINR(c.gross ?? 0)}{c.collected > 0 ? ` · ${displayINR(c.collected)} paid` : ""}</div>
              </Link>
              <button className="btn btn--ghost btn--sm" onClick={() => attach(c.id, false)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
