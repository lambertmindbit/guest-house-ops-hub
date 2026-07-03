"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { SectionLabel } from "@/components/ui";
import { displayINR } from "@/lib/format";

type TripStatus = "planned" | "done" | "cancelled";
type Driver = { id: string; name: string; phone: string | null; vehicleNumber: string | null };
type Guest = { id: string; name: string };
type Trip = { id: string; driverId: string | null; driverName: string | null; guestId: string | null; guestName: string | null; pickup: string; dropoff: string; scheduledAt: string | null; status: TripStatus; fare: number | null };

const STATUS_LABEL: Record<TripStatus, string> = { planned: "Planned", done: "Done", cancelled: "Cancelled" };

export function TransportBoard({ drivers, guests, trips, doneFares }: { drivers: Driver[]; guests: Guest[]; trips: Trip[]; doneFares: number }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [nd, setNd] = useState({ name: "", phone: "", vehicleNumber: "" });
  const [nt, setNt] = useState({ driverId: "", guestId: "", pickup: "", dropoff: "", scheduledAt: "", fare: "", status: "planned" as TripStatus });
  const [editDriverId, setEditDriverId] = useState<string | null>(null);
  const [editDriver, setEditDriver] = useState({ name: "", phone: "", vehicleNumber: "" });
  const [editTripId, setEditTripId] = useState<string | null>(null);
  const [editTrip, setEditTrip] = useState({ driverId: "", guestId: "", pickup: "", dropoff: "", scheduledAt: "", fare: "" });
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  function startEditDriver(d: Driver) {
    setEditDriverId(d.id);
    setEditDriver({ name: d.name, phone: d.phone ?? "", vehicleNumber: d.vehicleNumber ?? "" });
  }
  async function saveDriver(id: string) {
    if (!editDriver.name.trim()) return;
    if (await call(`/api/drivers/${id}`, { name: editDriver.name.trim(), phone: editDriver.phone.trim() || null, vehicleNumber: editDriver.vehicleNumber.trim() || null }, "PATCH")) setEditDriverId(null);
  }
  function startEditTrip(t: Trip) {
    setEditTripId(t.id);
    setEditTrip({ driverId: t.driverId ?? "", guestId: t.guestId ?? "", pickup: t.pickup, dropoff: t.dropoff, scheduledAt: t.scheduledAt ?? "", fare: t.fare != null ? String(t.fare) : "" });
  }
  async function saveTrip(id: string) {
    if (!editTrip.pickup.trim() || !editTrip.dropoff.trim()) return;
    if (await call(`/api/trips/${id}`, { driverId: editTrip.driverId || null, guestId: editTrip.guestId || null, pickup: editTrip.pickup.trim(), dropoff: editTrip.dropoff.trim(), scheduledAt: editTrip.scheduledAt || null, fare: editTrip.fare ? Number(editTrip.fare) : null }, "PATCH")) setEditTripId(null);
  }

  return (
    <div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)" }}>{error}</p>}
      <div className="note" style={{ marginBottom: 12 }}>Records only — live cab dispatch is handled by the ROOT assistant.</div>

      {/* Drivers */}
      <SectionLabel count={drivers.length}>Drivers</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <input className="input" placeholder="Driver name" value={nd.name} onChange={(e) => setNd({ ...nd, name: e.target.value })} />
          <input className="input" placeholder="Phone" value={nd.phone} onChange={(e) => setNd({ ...nd, phone: e.target.value })} />
          <input className="input" placeholder="Vehicle number" value={nd.vehicleNumber} onChange={(e) => setNd({ ...nd, vehicleNumber: e.target.value })} />
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!nd.name.trim()}
          onClick={async () => { if (await call("/api/drivers", { name: nd.name, phone: nd.phone || null, vehicleNumber: nd.vehicleNumber || null })) setNd({ name: "", phone: "", vehicleNumber: "" }); }}>
          Add driver
        </button>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {drivers.map((d) => (
          editDriverId === d.id ? (
            <div key={d.id} className="card card--pad" style={{ padding: 12 }}>
              <div className="form-grid" style={{ gap: 10 }}>
                <input className="input" placeholder="Driver name" value={editDriver.name} onChange={(e) => setEditDriver({ ...editDriver, name: e.target.value })} />
                <input className="input" placeholder="Phone" value={editDriver.phone} onChange={(e) => setEditDriver({ ...editDriver, phone: e.target.value })} />
                <input className="input" placeholder="Vehicle number" value={editDriver.vehicleNumber} onChange={(e) => setEditDriver({ ...editDriver, vehicleNumber: e.target.value })} />
              </div>
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button className="btn btn--primary btn--sm" onClick={() => saveDriver(d.id)} disabled={!editDriver.name.trim()}>Save</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setEditDriverId(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={d.id} className="rowcard">
              <div className="rowcard__main">
                <div className="rowcard__name">{d.name}</div>
                <div className="rowcard__meta">{[d.phone, d.vehicleNumber].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn--ghost btn--sm" onClick={() => startEditDriver(d)}>Edit</button>
                <button className="btn btn--quiet btn--icon btn--sm" onClick={async () => { if (await confirm({ title: "Remove driver", message: "Delete this driver?", danger: true, confirmLabel: "Delete" })) call(`/api/drivers/${d.id}`, {}, "DELETE"); }} aria-label="Delete driver">✕</button>
              </div>
            </div>
          )
        ))}
      </div>

      {/* Trips */}
      <SectionLabel count={trips.length} action={<span className="badge badge--paid">{displayINR(doneFares)} fares</span>}>Trips</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <select className="select" value={nt.driverId} onChange={(e) => setNt({ ...nt, driverId: e.target.value })}>
            <option value="">Driver…</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="select" value={nt.guestId} onChange={(e) => setNt({ ...nt, guestId: e.target.value })}>
            <option value="">Guest…</option>{guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input className="input" type="date" value={nt.scheduledAt} onChange={(e) => setNt({ ...nt, scheduledAt: e.target.value })} />
          <input className="input" placeholder="Pickup" value={nt.pickup} onChange={(e) => setNt({ ...nt, pickup: e.target.value })} />
          <input className="input" placeholder="Drop-off" value={nt.dropoff} onChange={(e) => setNt({ ...nt, dropoff: e.target.value })} />
          <input className="input" inputMode="numeric" placeholder="Fare ₹" value={nt.fare} onChange={(e) => setNt({ ...nt, fare: e.target.value })} />
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!nt.pickup.trim() || !nt.dropoff.trim()}
          onClick={async () => { if (await call("/api/trips", { driverId: nt.driverId || null, guestId: nt.guestId || null, pickup: nt.pickup, dropoff: nt.dropoff, scheduledAt: nt.scheduledAt || null, fare: nt.fare ? Number(nt.fare) : null, status: nt.status })) setNt({ driverId: "", guestId: "", pickup: "", dropoff: "", scheduledAt: "", fare: "", status: "planned" }); }}>
          Add trip
        </button>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {trips.map((t) => (
          editTripId === t.id ? (
            <div key={t.id} className="card card--pad" style={{ padding: 12 }}>
              <div className="form-grid" style={{ gap: 10 }}>
                <select className="select" value={editTrip.driverId} onChange={(e) => setEditTrip({ ...editTrip, driverId: e.target.value })}>
                  <option value="">Driver…</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select className="select" value={editTrip.guestId} onChange={(e) => setEditTrip({ ...editTrip, guestId: e.target.value })}>
                  <option value="">Guest…</option>{guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <input className="input" type="date" value={editTrip.scheduledAt} onChange={(e) => setEditTrip({ ...editTrip, scheduledAt: e.target.value })} />
                <input className="input" placeholder="Pickup" value={editTrip.pickup} onChange={(e) => setEditTrip({ ...editTrip, pickup: e.target.value })} />
                <input className="input" placeholder="Drop-off" value={editTrip.dropoff} onChange={(e) => setEditTrip({ ...editTrip, dropoff: e.target.value })} />
                <input className="input" inputMode="numeric" placeholder="Fare ₹" value={editTrip.fare} onChange={(e) => setEditTrip({ ...editTrip, fare: e.target.value })} />
              </div>
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button className="btn btn--primary btn--sm" onClick={() => saveTrip(t.id)} disabled={!editTrip.pickup.trim() || !editTrip.dropoff.trim()}>Save</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setEditTripId(null)}>Cancel</button>
                <button className="btn btn--danger btn--sm" style={{ marginLeft: "auto" }} onClick={async () => { if (await confirm({ title: "Delete trip", message: "Remove this trip from the log?", danger: true, confirmLabel: "Delete" })) { if (await call(`/api/trips/${t.id}`, {}, "DELETE")) setEditTripId(null); } }}>Delete</button>
              </div>
            </div>
          ) : (
            <div key={t.id} className="rowcard">
              <div className="rowcard__main">
                <div className="rowcard__name">{t.pickup} → {t.dropoff}{t.guestName ? <span style={{ fontWeight: 400 }}> — {t.guestName}</span> : null}</div>
                <div className="rowcard__meta">{[t.driverName, t.scheduledAt, t.fare != null ? displayINR(t.fare) : null].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <div className="row" style={{ gap: 6, alignItems: "center" }}>
                <select className="select" style={{ width: 120 }} value={t.status} onChange={(e) => call(`/api/trips/${t.id}`, { status: e.target.value }, "PATCH")}>
                  {(["planned", "done", "cancelled"] as TripStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <button className="btn btn--ghost btn--sm" onClick={() => startEditTrip(t)}>Edit</button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
