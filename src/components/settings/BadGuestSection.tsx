"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestAlertView } from "@/lib/community/badguest";

const STATUS_CLS: Record<string, string> = {
  submitted: "badge--warn", verified: "badge--good", disputed: "badge--neutral", rejected: "badge--neutral",
};
const CATEGORIES = ["damage", "disturbance", "rule_breach", "threat", "other"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  damage: "Property damage", disturbance: "Disturbance", rule_breach: "House-rule breach", threat: "Threat / abuse", other: "Other",
};

export function BadGuestSection({ mine, shared }: { mine: GuestAlertView[]; shared: GuestAlertView[] }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("damage");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lookup, setLookup] = useState("");
  const [matches, setMatches] = useState<GuestAlertView[] | null>(null);

  async function report() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/community/guest-alerts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, guestName: guestName || undefined, category, reason, evidenceNote: evidence || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not file the alert.");
      return;
    }
    setPhone(""); setGuestName(""); setCategory("damage"); setReason(""); setEvidence("");
    router.refresh();
  }

  async function act(id: string, action: "verify" | "dispute") {
    const res = await fetch(`/api/community/guest-alerts/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (res.ok) router.refresh();
    else { const j = await res.json().catch(() => ({})); setError(j.error ?? "Could not update the alert."); }
  }

  async function runLookup() {
    const res = await fetch(`/api/community/guest-alerts?lookup=${encodeURIComponent(lookup)}`);
    setMatches(res.ok ? ((await res.json()).data as GuestAlertView[]) : []);
  }

  function Card({ a }: { a: GuestAlertView }) {
    return (
      <div className="card card--pad" style={{ padding: 14 }}>
        <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>
              {a.guestNameMasked ?? "Guest"} ••••{a.guestPhoneLast4 ?? "????"}
              <span className="muted" style={{ fontWeight: 400 }}> · {a.mine ? "you" : a.reporterName}</span>
            </div>
            <div style={{ fontSize: "var(--fs-small)", marginTop: 2 }}><span className="badge badge--neutral">{CATEGORY_LABEL[a.category]}</span> {a.reason}</div>
            {a.evidenceNote && <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>Evidence: {a.evidenceNote}</div>}
            <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>Reported {a.createdAt}{a.expiresAt ? ` · expires ${a.expiresAt}` : ""}</div>
          </div>
          <span className={`badge ${STATUS_CLS[a.status]}`}>{a.status}</span>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          {a.mine && a.status === "submitted" && <button className="btn btn--primary btn--sm" onClick={() => act(a.id, "verify")}>Verify &amp; share</button>}
          {a.status !== "disputed" && <button className="btn btn--ghost btn--sm" onClick={() => act(a.id, "dispute")}>Dispute</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Lookup */}
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="h3" style={{ marginBottom: 8 }}>Check a guest</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Guest phone number" />
          <button className="btn btn--primary btn--sm" onClick={runLookup} disabled={!lookup.trim()}>Check</button>
        </div>
        {matches && (
          matches.length === 0
            ? <div className="badge badge--good" style={{ marginTop: 10 }}>No alerts in your network</div>
            : <div className="col" style={{ gap: 8, marginTop: 10 }}>{matches.map((m) => <Card key={m.id} a={m} />)}</div>
        )}
      </div>

      {/* Report */}
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="h3" style={{ marginBottom: 10 }}>Report a bad guest</div>
        <div className="form-grid" style={{ gap: 12 }}>
          <div><label className="field-label">Guest phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Stored hashed — not shared raw" /></div>
          <div><label className="field-label">Guest name</label><input className="input" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="First name only is shared" /></div>
          <div><label className="field-label">Category</label>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>
          <div><label className="field-label">Reason</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened" /></div>
          <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Evidence (required to share)</label><textarea className="textarea" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Photo ref, invoice, police complaint no., rule broken" style={{ minHeight: 52 }} /></div>
        </div>
        {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 8 }}>{error}</p>}
        <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 8 }}>
          An alert is private until you verify it. Only verified alerts are shared with peers you enable bad-guest sharing for (Trusted network), and they expire automatically.
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 12 }} onClick={report} disabled={busy || !phone.trim() || !reason.trim()}>
          {busy ? "Saving…" : "File alert"}
        </button>
      </div>

      {/* My alerts */}
      <div className="spread" style={{ marginBottom: 8 }}>
        <div className="setgroup__label" style={{ margin: 0 }}>Your alerts</div>
        {mine.length > 0 && <a className="btn btn--ghost btn--sm" href="/api/community/guest-alerts/export.csv" download>Export CSV</a>}
      </div>
      {mine.length === 0 ? <div className="empty" style={{ marginBottom: 14 }}>No alerts yet.</div> : (
        <div className="col" style={{ gap: 8, marginBottom: 14 }}>{mine.map((a) => <Card key={a.id} a={a} />)}</div>
      )}

      {/* Shared with me */}
      <div className="setgroup__label">Shared by your network</div>
      {shared.length === 0 ? <div className="empty">No shared alerts yet.</div> : (
        <div className="col" style={{ gap: 8 }}>{shared.map((a) => <Card key={a.id} a={a} />)}</div>
      )}
    </div>
  );
}
