"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionLabel } from "@/components/ui";
import { displayINR } from "@/lib/format";

type TourStatus = "planned" | "confirmed" | "completed" | "cancelled";
type Tour = { id: string; name: string; price: number | null; partnerId: string | null; partnerName: string | null; active: boolean };
type Partner = { id: string; name: string; contact: string | null; commissionPct: number | null };
type Booking = { id: string; tourName: string; partnerName: string | null; date: string | null; amount: number | null; status: TourStatus };
type Summary = { bookings: number; revenue: number; commission: number };

const STATUS_CLS: Record<TourStatus, string> = { planned: "badge--warn", confirmed: "badge--sent", completed: "badge--good", cancelled: "badge--neutral" };
const STATUSES: TourStatus[] = ["planned", "confirmed", "completed", "cancelled"];

export function ToursBoard({ tours, partners, bookings, summary }: { tours: Tour[]; partners: Partner[]; bookings: Booking[]; summary: Summary }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [np, setNp] = useState({ name: "", contact: "", commissionPct: "" });
  const [nt, setNt] = useState({ name: "", price: "", partnerId: "" });
  const [nb, setNb] = useState({ tourId: "", date: "", amount: "" });
  const [editTourId, setEditTourId] = useState<string | null>(null);
  const [editTour, setEditTour] = useState({ name: "", price: "", partnerId: "" });
  const [editPartnerId, setEditPartnerId] = useState<string | null>(null);
  const [editPartner, setEditPartner] = useState({ name: "", contact: "", commissionPct: "" });

  async function call(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  async function saveTour(id: string) {
    if (!editTour.name.trim()) return;
    if (await call(`/api/tours/${id}`, { name: editTour.name.trim(), price: editTour.price ? Number(editTour.price) : null, partnerId: editTour.partnerId || null }, "PATCH")) setEditTourId(null);
  }
  async function savePartner(id: string) {
    if (!editPartner.name.trim()) return;
    if (await call(`/api/tour-partners/${id}`, { name: editPartner.name.trim(), contact: editPartner.contact.trim() || null, commissionPct: editPartner.commissionPct ? Number(editPartner.commissionPct) : null }, "PATCH")) setEditPartnerId(null);
  }

  return (
    <div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginBottom: 10 }}>{error}</p>}

      {/* Summary */}
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 20, flexWrap: "wrap" }}>
          <div><div className="h3">{summary.bookings}</div><div className="muted" style={{ fontSize: "var(--fs-meta)" }}>Bookings</div></div>
          <div><div className="h3">{displayINR(summary.revenue)}</div><div className="muted" style={{ fontSize: "var(--fs-meta)" }}>Revenue</div></div>
          <div><div className="h3">{displayINR(summary.commission)}</div><div className="muted" style={{ fontSize: "var(--fs-meta)" }}>Partner commission</div></div>
        </div>
      </div>

      {/* Book a tour */}
      <SectionLabel>Book a tour for a guest</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <div>
            <label className="field-label">Tour</label>
            <select className="select" value={nb.tourId} onChange={(e) => setNb({ ...nb, tourId: e.target.value })}>
              <option value="">Choose…</option>
              {tours.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Date</label><input className="input" type="date" value={nb.date} onChange={(e) => setNb({ ...nb, date: e.target.value })} /></div>
          <div><label className="field-label">Amount</label><input className="input" inputMode="numeric" value={nb.amount} onChange={(e) => setNb({ ...nb, amount: e.target.value })} placeholder="₹" /></div>
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!nb.tourId}
          onClick={async () => { if (await call("/api/tour-bookings", { tourId: nb.tourId, date: nb.date || null, amount: nb.amount ? Number(nb.amount) : null })) setNb({ tourId: "", date: "", amount: "" }); }}>
          Add booking
        </button>
      </div>

      {bookings.length > 0 && (
        <div className="col" style={{ gap: 8, marginBottom: 14 }}>
          {bookings.map((b) => (
            <div key={b.id} className="card card--pad" style={{ padding: 14 }}>
              <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{b.tourName}{b.partnerName ? <span className="muted" style={{ fontWeight: 400 }}> · {b.partnerName}</span> : null}</div>
                  <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>{b.date ?? "No date"}{b.amount != null ? ` · ${displayINR(b.amount)}` : ""}</div>
                </div>
                <select className="select" style={{ width: 130 }} value={b.status} onChange={(e) => call(`/api/tour-bookings/${b.id}`, { status: e.target.value }, "PATCH")}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <span className={`badge ${STATUS_CLS[b.status]}`} style={{ marginTop: 8, display: "inline-block" }}>{b.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tours catalog */}
      <SectionLabel>Tours offered</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 10 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <div><label className="field-label">Name</label><input className="input" value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} placeholder="e.g. Living-root bridge trek" /></div>
          <div><label className="field-label">Price</label><input className="input" inputMode="numeric" value={nt.price} onChange={(e) => setNt({ ...nt, price: e.target.value })} placeholder="₹" /></div>
          <div>
            <label className="field-label">Partner</label>
            <select className="select" value={nt.partnerId} onChange={(e) => setNt({ ...nt, partnerId: e.target.value })}>
              <option value="">None</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!nt.name.trim()}
          onClick={async () => { if (await call("/api/tours", { name: nt.name, price: nt.price ? Number(nt.price) : null, partnerId: nt.partnerId || null })) setNt({ name: "", price: "", partnerId: "" }); }}>
          Add tour
        </button>
      </div>
      <div className="col" style={{ gap: 6, marginBottom: 14 }}>
        {tours.map((t) => (
          editTourId === t.id ? (
            <div key={t.id} className="card card--pad" style={{ padding: 12 }}>
              <div className="form-grid" style={{ gap: 10 }}>
                <input className="input" placeholder="Tour name" value={editTour.name} onChange={(e) => setEditTour({ ...editTour, name: e.target.value })} />
                <input className="input" inputMode="numeric" placeholder="Price ₹" value={editTour.price} onChange={(e) => setEditTour({ ...editTour, price: e.target.value })} />
                <select className="select" value={editTour.partnerId} onChange={(e) => setEditTour({ ...editTour, partnerId: e.target.value })}>
                  <option value="">No partner</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button className="btn btn--primary btn--sm" onClick={() => saveTour(t.id)} disabled={!editTour.name.trim()}>Save</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setEditTourId(null)}>Cancel</button>
                <button className="btn btn--danger btn--sm" style={{ marginLeft: "auto" }} onClick={() => call(`/api/tours/${t.id}`, {}, "DELETE")}>Delete</button>
              </div>
            </div>
          ) : (
            <div key={t.id} className="spread card card--pad" style={{ padding: 12 }}>
              <span>{t.name}{t.partnerName ? <span className="muted"> · {t.partnerName}</span> : null}</span>
              <span className="row" style={{ gap: 8, alignItems: "center" }}>
                <span className="muted">{t.price != null ? displayINR(t.price) : "—"}</span>
                <button className="btn btn--ghost btn--sm" onClick={() => { setEditTourId(t.id); setEditTour({ name: t.name, price: t.price != null ? String(t.price) : "", partnerId: t.partnerId ?? "" }); }}>Edit</button>
              </span>
            </div>
          )
        ))}
      </div>

      {/* Partners */}
      <SectionLabel>Partners &amp; guides</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 10 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <div><label className="field-label">Name</label><input className="input" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /></div>
          <div><label className="field-label">Contact</label><input className="input" value={np.contact} onChange={(e) => setNp({ ...np, contact: e.target.value })} /></div>
          <div><label className="field-label">Commission %</label><input className="input" inputMode="numeric" value={np.commissionPct} onChange={(e) => setNp({ ...np, commissionPct: e.target.value })} /></div>
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} disabled={!np.name.trim()}
          onClick={async () => { if (await call("/api/tour-partners", { name: np.name, contact: np.contact || null, commissionPct: np.commissionPct ? Number(np.commissionPct) : null })) setNp({ name: "", contact: "", commissionPct: "" }); }}>
          Add partner
        </button>
      </div>
      <div className="col" style={{ gap: 6 }}>
        {partners.map((p) => (
          editPartnerId === p.id ? (
            <div key={p.id} className="card card--pad" style={{ padding: 12 }}>
              <div className="form-grid" style={{ gap: 10 }}>
                <input className="input" placeholder="Name" value={editPartner.name} onChange={(e) => setEditPartner({ ...editPartner, name: e.target.value })} />
                <input className="input" placeholder="Contact" value={editPartner.contact} onChange={(e) => setEditPartner({ ...editPartner, contact: e.target.value })} />
                <input className="input" inputMode="numeric" placeholder="Commission %" value={editPartner.commissionPct} onChange={(e) => setEditPartner({ ...editPartner, commissionPct: e.target.value })} />
              </div>
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button className="btn btn--primary btn--sm" onClick={() => savePartner(p.id)} disabled={!editPartner.name.trim()}>Save</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setEditPartnerId(null)}>Cancel</button>
                <button className="btn btn--danger btn--sm" style={{ marginLeft: "auto" }} onClick={() => call(`/api/tour-partners/${p.id}`, {}, "DELETE")}>Delete</button>
              </div>
            </div>
          ) : (
            <div key={p.id} className="spread card card--pad" style={{ padding: 12 }}>
              <span>{p.name}{p.contact ? <span className="muted"> · {p.contact}</span> : null}</span>
              <span className="row" style={{ gap: 8, alignItems: "center" }}>
                <span className="muted">{p.commissionPct != null ? `${p.commissionPct}%` : "—"}</span>
                <button className="btn btn--ghost btn--sm" onClick={() => { setEditPartnerId(p.id); setEditPartner({ name: p.name, contact: p.contact ?? "", commissionPct: p.commissionPct != null ? String(p.commissionPct) : "" }); }}>Edit</button>
              </span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
