"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send, ErrorLine, type Settings } from "./shared";
import { DEFAULT_GST_SLABS } from "@/lib/gst";
import { rupeesToPaise, paiseToRupees } from "@/lib/money";

export function PropertySection({ settings }: { settings: Settings }) {
  const router = useRouter();
  // GST slab table, editable because tax rates change (the 12% band became 5% in
  // Sep 2025) — a rate change must never need a code deploy. Thresholds shown in
  // rupees; blank upper bound = "and above".
  const [slabs, setSlabs] = useState(
    (settings?.gstSlabs ?? DEFAULT_GST_SLABS).map((s) => ({
      upto: s.uptoPaise === null ? "" : String(paiseToRupees(s.uptoPaise)),
      rate: String(s.ratePct),
    })),
  );
  const [f, setF] = useState({
    name: settings?.name ?? "My Guest House",
    invoicePrefix: settings?.invoicePrefix ?? "",
    address: settings?.address ?? "",
    gstNumber: settings?.gstNumber ?? "",
    upiVpa: settings?.upiVpa ?? "",
    idRetentionDays: settings?.idRetentionDays != null ? String(settings.idRetentionDays) : "",
    idPolicy: settings?.idPolicy ?? "block",
    idRequiredAtBooking: settings?.idRequiredAtBooking ?? false,
    inspectionRequired: settings?.inspectionRequired ?? false,
    checkInTime: settings?.checkInTime ?? "14:00",
    checkOutTime: settings?.checkOutTime ?? "11:00",
    currency: settings?.currency ?? "INR",
    timezone: settings?.timezone ?? "Asia/Kolkata",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await send("PATCH", "/api/settings", {
      ...f,
      address: f.address || null,
      gstNumber: f.gstNumber || null,
      upiVpa: f.upiVpa || null,
      idRetentionDays: f.idRetentionDays ? Number(f.idRetentionDays) : null,
      idPolicy: f.idPolicy,
      idRequiredAtBooking: f.idRequiredAtBooking,
      invoicePrefix: f.invoicePrefix || null,
      // Thresholds are entered in rupees; stored as paise (GAP-9).
      gstSlabs: slabs.map((s) => ({
        uptoPaise: s.upto.trim() === "" ? null : rupeesToPaise(Number(s.upto)),
        ratePct: Number(s.rate),
      })),
    });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card card--pad">
      <ErrorLine msg={error} />
      <div className="form-grid">
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Property name <span className="req">*</span></label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Address</label>
          <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Used on printed invoices" />
        </div>
        <div>
          <label className="field-label">Check-in time</label>
          <input className="input" type="time" value={f.checkInTime} onChange={(e) => setF({ ...f, checkInTime: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Check-out time</label>
          <input className="input" type="time" value={f.checkOutTime} onChange={(e) => setF({ ...f, checkOutTime: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Currency</label>
          <input className="input" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} />
        </div>
        <div>
          <label className="field-label">GST number</label>
          <input className="input" value={f.gstNumber} onChange={(e) => setF({ ...f, gstNumber: e.target.value })} placeholder="Optional" />
          <div className="field-hint">Leave blank if you aren’t GST-registered — invoices then carry no tax lines.</div>
        </div>
        <div>
          <label className="field-label">Invoice number prefix</label>
          <input className="input" value={f.invoicePrefix} onChange={(e) => setF({ ...f, invoicePrefix: e.target.value })} placeholder="e.g. GH" maxLength={8} />
          <div className="field-hint">Numbers run as PREFIX/2026-27/0001, restarting each financial year.</div>
        </div>

        {f.gstNumber.trim() !== "" && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">GST rate slabs</label>
            <div className="field-hint" style={{ marginBottom: 8 }}>
              Applied to the room tariff <b>per night</b>. Defaults follow the current hotel
              slabs (up to ₹1,000 nil · ₹1,001–₹7,500 at 5% · above ₹7,500 at 18%).
              <b> Confirm these with your accountant</b> — rates change, and the invoice records whichever rate applied.
            </div>
            <div className="col" style={{ gap: 8 }}>
              {slabs.map((s, i) => (
                <div className="row" key={i} style={{ gap: 8, alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: "var(--fs-meta)", width: 62 }}>Up to ₹</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    style={{ flex: 1 }}
                    placeholder="and above"
                    value={s.upto}
                    onChange={(e) => setSlabs(slabs.map((x, xi) => (xi === i ? { ...x, upto: e.target.value } : x)))}
                  />
                  <input
                    className="input"
                    inputMode="numeric"
                    style={{ width: 80 }}
                    value={s.rate}
                    onChange={(e) => setSlabs(slabs.map((x, xi) => (xi === i ? { ...x, rate: e.target.value } : x)))}
                  />
                  <span className="muted" style={{ fontSize: "var(--fs-meta)" }}>%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">UPI ID (VPA)</label>
          <input className="input" value={f.upiVpa} onChange={(e) => setF({ ...f, upiVpa: e.target.value })} placeholder="e.g. lawei@okhdfcbank" />
          <div className="field-hint">Used to offer guests a tap-to-pay UPI link for the balance. Leave blank to hide it.</div>
        </div>
        <div>
          <label className="field-label">ID document retention (days)</label>
          <input className="input" inputMode="numeric" value={f.idRetentionDays} onChange={(e) => setF({ ...f, idRetentionDays: e.target.value.replace(/\D/g, "") })} placeholder="Blank = keep forever" />
          <div className="field-hint">Scanned guest IDs older than this are auto-deleted each night (privacy). New properties default to 180 days; blank keeps them indefinitely.</div>
        </div>
        <div>
          <label className="field-label">ID at check-in</label>
          <select className="select" value={f.idPolicy} onChange={(e) => setF({ ...f, idPolicy: e.target.value })}>
            <option value="block">Required — block check-in without ID</option>
            <option value="warn">Warn only — allow check-in, show a reminder</option>
            <option value="off">Off — no ID check</option>
          </select>
          <div className="field-hint">Foreign guests also need the C-Form (passport) unless this is Off.</div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="row" style={{ gap: 8, cursor: "pointer", fontSize: "var(--fs-small)" }}>
            <input type="checkbox" checked={f.idRequiredAtBooking} onChange={(e) => setF({ ...f, idRequiredAtBooking: e.target.checked })} />
            <span>Require an ID number to <b>take a booking</b> (for walk-in-only properties)</span>
          </label>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="row" style={{ gap: 8, cursor: "pointer", fontSize: "var(--fs-small)" }}>
            <input type="checkbox" checked={f.inspectionRequired} onChange={(e) => setF({ ...f, inspectionRequired: e.target.checked })} />
            <span>Add a housekeeping <b>inspection step</b> — a cleaned room waits for “mark inspected” before it counts as ready</span>
          </label>
        </div>
      </div>
      <div className="field-hint" style={{ marginTop: 10 }}>Timezone: {f.timezone} — drives “today”, arrivals and the calendar.</div>
      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save property"}</button>
        {saved && <span style={{ fontSize: "var(--fs-small)", color: "var(--green-text)", fontWeight: 600 }}>Saved</span>}
      </div>
    </form>
  );
}
