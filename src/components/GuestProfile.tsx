"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type GuestProfileValues = {
  id: string;
  name: string;
  email: string;
  idNumber: string;
  notes: string;
  address: string;
  vehicleNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferences: string; // comma-separated in the form; stored as a string[]
  idChecked: boolean;
  idPhotocopied: boolean;
  idVerificationCompleted: boolean;
  consentGiven: boolean;
  blocked: boolean;
  blockReason: string;
  // C-Form
  nationality: string;
  passportNumber: string;
  passportIssueDate: string;
  passportIssuePlace: string;
  passportExpiry: string;
  visaNumber: string;
  visaType: string;
  visaIssueDate: string;
  visaIssuePlace: string;
  visaExpiry: string;
  portOfEntry: string;
  arrivalInIndia: string;
  purposeOfVisit: string;
};

const CFORM_KEYS: (keyof GuestProfileValues)[] = [
  "nationality", "passportNumber", "passportIssueDate", "passportIssuePlace",
  "passportExpiry", "visaNumber", "visaType", "visaIssueDate", "visaIssuePlace",
  "visaExpiry", "portOfEntry", "arrivalInIndia", "purposeOfVisit",
];

function hasCformData(v: GuestProfileValues) {
  return CFORM_KEYS.some((k) => !!v[k]);
}

export function GuestProfile({ initial }: { initial: GuestProfileValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCform, setShowCform] = useState(() => hasCformData(initial));

  function set(field: keyof GuestProfileValues, value: string | boolean) {
    setV((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/guests/${v.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: v.name,
        email: v.email || null,
        idNumber: v.idNumber || null,
        notes: v.notes || null,
        address: v.address || null,
        vehicleNumber: v.vehicleNumber || null,
        emergencyContactName: v.emergencyContactName || null,
        emergencyContactPhone: v.emergencyContactPhone || null,
        preferences: v.preferences.split(",").map((s) => s.trim()).filter(Boolean),
        idChecked: v.idChecked,
        idPhotocopied: v.idPhotocopied,
        idVerificationCompleted: v.idVerificationCompleted,
        consentGiven: v.consentGiven,
        blocked: v.blocked,
        blockReason: v.blocked ? v.blockReason || null : null,
        // C-Form — send nulls for empty strings so the DB is cleaned up
        nationality: v.nationality || null,
        passportNumber: v.passportNumber || null,
        passportIssueDate: v.passportIssueDate || null,
        passportIssuePlace: v.passportIssuePlace || null,
        passportExpiry: v.passportExpiry || null,
        visaNumber: v.visaNumber || null,
        visaType: v.visaType || null,
        visaIssueDate: v.visaIssueDate || null,
        visaIssuePlace: v.visaIssuePlace || null,
        visaExpiry: v.visaExpiry || null,
        portOfEntry: v.portOfEntry || null,
        arrivalInIndia: v.arrivalInIndia || null,
        purposeOfVisit: v.purposeOfVisit || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", margin: "0 0 10px" }}>{error}</p>}

      <div className="form-grid" style={{ gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Name</label>
          <input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input className="input" value={v.email} onChange={(e) => set("email", e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="field-label">ID number</label>
          <input className="input" value={v.idNumber} onChange={(e) => set("idNumber", e.target.value)} placeholder="Passport / Aadhaar / etc." />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Address</label>
          <textarea className="textarea" value={v.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, town, state" style={{ minHeight: 56 }} />
        </div>
        <div>
          <label className="field-label">Vehicle number</label>
          <input className="input" value={v.vehicleNumber} onChange={(e) => set("vehicleNumber", e.target.value)} placeholder="e.g. ML05 1234" />
        </div>
        <div>
          <label className="field-label">Preferences</label>
          <input className="input" value={v.preferences} onChange={(e) => set("preferences", e.target.value)} placeholder="ground floor, no pets (comma-separated)" />
        </div>
        <div>
          <label className="field-label">Emergency contact name</label>
          <input className="input" value={v.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="field-label">Emergency contact phone</label>
          <input className="input" value={v.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} placeholder="Optional" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Notes</label>
          <textarea className="textarea" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Allergies, history…" />
        </div>
      </div>

      {/* ID & verification — the compliance trail an inspection expects. */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 600, fontSize: "var(--fs-small)", marginBottom: 8 }}>ID &amp; verification</div>
        <div className="col" style={{ gap: 8 }}>
          {([
            ["idChecked", "ID checked against the guest"],
            ["idPhotocopied", "ID photocopied / scanned"],
            ["idVerificationCompleted", "Verification completed"],
          ] as const).map(([key, label]) => (
            <label key={key} className="row" style={{ gap: 8, cursor: "pointer", fontSize: "var(--fs-small)" }}>
              <input type="checkbox" checked={v[key]} onChange={(e) => set(key, e.target.checked)} />
              <span>{label}</span>
            </label>
          ))}
          <div className="faint" style={{ fontSize: "var(--fs-meta)" }}>
            “ID uploaded” is set automatically when a document is attached below.
          </div>
          <label className="row" style={{ gap: 8, cursor: "pointer", fontSize: "var(--fs-small)", marginTop: 6 }}>
            <input type="checkbox" checked={v.consentGiven} onChange={(e) => set("consentGiven", e.target.checked)} />
            <span>Guest consented to storing their details (privacy)</span>
          </label>
        </div>
      </div>

      {/* C-Form section — auto-shown when data already exists, toggle otherwise */}
      <div style={{ marginTop: 16 }}>
        {!showCform ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setShowCform(true)}
          >
            + Add C-Form details (foreign national)
          </button>
        ) : (
          <div>
            <div className="spread" style={{ marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: "var(--fs-small)" }}>C-Form — Foreign national</span>
              {!hasCformData(v) && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowCform(false)}>Hide</button>
              )}
            </div>

            <div className="form-grid" style={{ gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="field-label">Nationality</label>
                <input className="input" value={v.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. French" />
              </div>

              <div>
                <label className="field-label">Passport number</label>
                <input className="input" value={v.passportNumber} onChange={(e) => set("passportNumber", e.target.value)} placeholder="e.g. AB1234567" />
              </div>
              <div>
                <label className="field-label">Place of issue</label>
                <input className="input" value={v.passportIssuePlace} onChange={(e) => set("passportIssuePlace", e.target.value)} placeholder="e.g. Paris" />
              </div>
              <div>
                <label className="field-label">Passport issue date</label>
                <input className="input" type="date" value={v.passportIssueDate} onChange={(e) => set("passportIssueDate", e.target.value)} />
              </div>
              <div>
                <label className="field-label">Passport expiry</label>
                <input className="input" type="date" value={v.passportExpiry} onChange={(e) => set("passportExpiry", e.target.value)} />
              </div>

              <div>
                <label className="field-label">Visa number</label>
                <input className="input" value={v.visaNumber} onChange={(e) => set("visaNumber", e.target.value)} placeholder="e.g. IND-2026-000001" />
              </div>
              <div>
                <label className="field-label">Visa type</label>
                <input className="input" value={v.visaType} onChange={(e) => set("visaType", e.target.value)} placeholder="e.g. Tourist, e-Visa" />
              </div>
              <div>
                <label className="field-label">Visa issue place</label>
                <input className="input" value={v.visaIssuePlace} onChange={(e) => set("visaIssuePlace", e.target.value)} placeholder="e.g. New Delhi Embassy" />
              </div>
              <div>
                <label className="field-label">Visa issue date</label>
                <input className="input" type="date" value={v.visaIssueDate} onChange={(e) => set("visaIssueDate", e.target.value)} />
              </div>
              <div>
                <label className="field-label">Visa expiry</label>
                <input className="input" type="date" value={v.visaExpiry} onChange={(e) => set("visaExpiry", e.target.value)} />
              </div>

              <div>
                <label className="field-label">Port of entry to India</label>
                <input className="input" value={v.portOfEntry} onChange={(e) => set("portOfEntry", e.target.value)} placeholder="e.g. Delhi IGI Airport" />
              </div>
              <div>
                <label className="field-label">Date of arrival in India</label>
                <input className="input" type="date" value={v.arrivalInIndia} onChange={(e) => set("arrivalInIndia", e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="field-label">Purpose of visit</label>
                <input className="input" value={v.purposeOfVisit} onChange={(e) => set("purposeOfVisit", e.target.value)} placeholder="e.g. Tourism, Business" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="spread" style={{ padding: "14px 0 2px", borderTop: "1px solid var(--border)", marginTop: 14 }}>
        <label style={{ fontWeight: 600, color: v.blocked ? "var(--red-text)" : "var(--ink)" }}>Blacklist this guest</label>
        <button type="button" className={`switch${v.blocked ? " on" : ""}`} onClick={() => set("blocked", !v.blocked)} aria-label="Blacklist"><span /></button>
      </div>
      {v.blocked && (
        <div style={{ marginTop: 10 }}>
          <label className="field-label">Reason (shown when booking)</label>
          <input className="input" value={v.blockReason} onChange={(e) => set("blockReason", e.target.value)} placeholder="e.g. damaged room, chargeback" />
        </div>
      )}

      <div className="row" style={{ gap: 10, marginTop: 16 }}>
        <button onClick={save} disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save guest"}</button>
        {saved && <span style={{ fontSize: "var(--fs-small)", color: "var(--green-text)" }}>Saved ✓</span>}
      </div>
    </div>
  );
}
