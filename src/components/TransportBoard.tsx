"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { SectionLabel } from "@/components/ui";
import { displayINR } from "@/lib/format";

type TripStatus = "planned" | "done" | "cancelled";
type Driver = { id: string; name: string; phone: string | null; vehicleNumber: string | null };
type Trip = { id: string; driverName: string | null; pickup: string; dropoff: string; scheduledAt: string | null; status: TripStatus; fare: number | null };

const STATUS_LABEL: Record<TripStatus, string> = { planned: "Planned", done: "Done", cancelled: "Cancelled" };

export function TransportBoard({ drivers, trips, doneFares }: { drivers: Driver[]; trips: Trip[]; doneFares: number }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [nd, setNd] = useState({ name: "", phone: "", vehicleNumber: "" });
  const [nt, setNt] = useState({ driverId: "", pickup: "", dropoff: "", scheduledAt: "", fare: "", status: "planned" as TripStatus });
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
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
          <div key={d.id} className="rowcard">
            <div className="rowcard__main">
              <div className="rowcard__name">{d.name}</div>
              <div className="rowcard__meta">{[d.phone, d.vehicleNumber].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <button className="btn btn--quiet btn--icon btn--sm" onClick={async () => { if (await confirm({ title: "Remove driver", message: "Delete this driver?", danger: true, confirmLabel: "Delete" })) call(`/api/drivers/${d.id}`, {}, "DELETE"); }} aria-label="Delete driver">✕</button>
          </div>
        ))}
      </div>

      {/* Trips */}
      <SectionLabel count={trips.length} action={<span className="badge badge--paid">{displayINR(doneFares)} fares</span>}>Trips</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <select className="select" value={nt.driverId} onChange={(e) => setNt({ ...nt, driverId: e.target.value })}>
            <option value="">Driver…</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input className="input" type="date" value={nt.scheduledAt} onChange={(e) => setNt({ ...nt, scheduledAt: e.target.value })} />
          <input className="input" placeholder="Pickup" value={nt.pickup} onChange={(e) => setNt({ ...nt, pickup: e.target.value })} />
          <input className="input" placeholder="Drop-off" value={nt.dropoff} onChange={(e) => setNt({ ...nt, dropoff: e.target.value })} />
          <input className="input" inputMode="numeric" placeholder="Fare ₹" value={nt.fare} onChange={(e) => setNt({ ...nt, fare: e.target.value })} />
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!nt.pickup.trim() || !nt.dropoff.trim()}
          onClick={async () => { if (await call("/api/trips", { driverId: nt.driverId || null, pickup: nt.pickup, dropoff: nt.dropoff, scheduledAt: nt.scheduledAt || null, fare: nt.fare ? Number(nt.fare) : null, status: nt.status })) setNt({ driverId: "", pickup: "", dropoff: "", scheduledAt: "", fare: "", status: "planned" }); }}>
          Add trip
        </button>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {trips.map((t) => (
          <div key={t.id} className="rowcard">
            <div className="rowcard__main">
              <div className="rowcard__name">{t.pickup} → {t.dropoff}</div>
              <div className="rowcard__meta">{[t.driverName, t.scheduledAt, t.fare != null ? displayINR(t.fare) : null].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <select className="select" style={{ width: 130 }} value={t.status} onChange={(e) => call(`/api/trips/${t.id}`, { status: e.target.value }, "PATCH")}>
              {(["planned", "done", "cancelled"] as TripStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
