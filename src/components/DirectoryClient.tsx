"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DirectoryEntry } from "@/lib/community/directory";

type RoomTypeAvail = { roomTypeId: string; roomTypeName: string; maxOccupancy: number; total: number; minAvailable: number };

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Availability peek for a connected peer. Fetches DERIVED availability (opt-in;
// 403 if the peer hasn't shared it). No guest/finance data ever comes back.
function AvailabilityPeek({ peerPropertyId }: { peerPropertyId: string }) {
  const [open, setOpen] = useState(false);
  const [checkIn, setCheckIn] = useState(todayPlus(0));
  const [checkOut, setCheckOut] = useState(todayPlus(1));
  const [rows, setRows] = useState<RoomTypeAvail[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    setRows(null);
    const params = new URLSearchParams({ peerPropertyId, checkIn, checkOut });
    const res = await fetch(`/api/community/availability?${params}`);
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not load availability.");
      return;
    }
    setRows((await res.json()).data as RoomTypeAvail[]);
  }

  if (!open) {
    return (
      <button className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
        Check availability
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label className="field-label">Check-in</label>
          <input className="input" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Check-out</label>
          <input className="input" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>
        <button className="btn btn--primary btn--sm" onClick={check} disabled={busy || checkOut <= checkIn}>
          {busy ? "Checking…" : "Check"}
        </button>
      </div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 8 }}>{error}</p>}
      {rows && (
        rows.length === 0 ? (
          <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 8 }}>No room types listed.</div>
        ) : (
          <div className="col" style={{ gap: 4, marginTop: 8 }}>
            {rows.map((r) => (
              <div key={r.roomTypeId} className="spread" style={{ fontSize: "var(--fs-small)" }}>
                <span>{r.roomTypeName} <span className="muted">· sleeps {r.maxOccupancy}</span></span>
                <span className={`badge ${r.minAvailable > 0 ? "badge--good" : "badge--neutral"}`}>
                  {r.minAvailable} of {r.total} free
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// Filter chips update the URL; the server re-runs searchDirectory and re-renders
// the list. Read-only discovery — no writes here.
export function DirectoryClient({
  entries,
  needs,
  priceBands,
  activeNeeds,
  activePriceBand,
}: {
  entries: DirectoryEntry[];
  needs: string[];
  priceBands: string[];
  activeNeeds: string[];
  activePriceBand: string | null;
}) {
  const router = useRouter();

  function apply(nextNeeds: string[], nextPriceBand: string | null) {
    const params = new URLSearchParams();
    for (const n of nextNeeds) params.append("need", n);
    if (nextPriceBand) params.set("priceBand", nextPriceBand);
    const qs = params.toString();
    router.push(qs ? `/directory?${qs}` : "/directory");
  }

  function toggleNeed(need: string) {
    apply(activeNeeds.includes(need) ? activeNeeds.filter((n) => n !== need) : [...activeNeeds, need], activePriceBand);
  }
  function togglePriceBand(band: string) {
    apply(activeNeeds, activePriceBand === band ? null : band);
  }

  return (
    <div>
      {/* Need + price filters */}
      <div className="chips" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {needs.map((n) => (
          <button key={n} className={`chip${activeNeeds.includes(n) ? " on" : ""}`} onClick={() => toggleNeed(n)}>{n}</button>
        ))}
        {priceBands.map((b) => (
          <button key={b} className={`chip${activePriceBand === b ? " on" : ""}`} onClick={() => togglePriceBand(b)} style={{ textTransform: "capitalize" }}>{b}</button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="empty">No properties match. Try fewer filters, or ask peers to make their listing discoverable.</div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {entries.map((e) => (
            <div key={e.propertyId} className="card card--pad" style={{ padding: 14 }}>
              <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {e.name}
                    {e.connected && <span className="badge badge--good" style={{ marginLeft: 8 }}>Connected</span>}
                  </div>
                  {e.locality && <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>{e.locality}</div>}
                </div>
                {e.priceBand && <span className="badge badge--neutral" style={{ textTransform: "capitalize" }}>{e.priceBand}</span>}
              </div>

              {e.bio && <p style={{ fontSize: "var(--fs-small)", margin: "8px 0 0" }}>{e.bio}</p>}

              {e.amenities.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {e.amenities.map((a) => <span key={a} className="badge badge--neutral">{a}</span>)}
                </div>
              )}

              {/* Contact phone is revealed only once connected (Q7). */}
              <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 10 }}>
                {e.contactPhone
                  ? <>Contact: <a href={`tel:${e.contactPhone}`}>{e.contactPhone}</a></>
                  : "Connect in Settings › Trusted network to see contact details."}
              </div>

              {/* Derived availability — only offered for connected peers. */}
              {e.connected && <AvailabilityPeek peerPropertyId={e.propertyId} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
