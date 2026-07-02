"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScamReportView } from "@/lib/community/scam";

const STATUS_CLS: Record<string, string> = {
  submitted: "badge--warn", verified: "badge--good", disputed: "badge--neutral", rejected: "badge--neutral",
};

export function ScamNetworkSection({ mine, shared }: { mine: ScamReportView[]; shared: ScamReportView[] }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lookup, setLookup] = useState("");
  const [matches, setMatches] = useState<ScamReportView[] | null>(null);

  async function report() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/community/scam", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, reason, evidenceNote: evidence || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not file the report.");
      return;
    }
    setPhone(""); setReason(""); setEvidence("");
    router.refresh();
  }

  async function act(id: string, action: "verify" | "dispute") {
    const res = await fetch(`/api/community/scam/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (res.ok) router.refresh();
    else { const j = await res.json().catch(() => ({})); setError(j.error ?? "Could not update the report."); }
  }

  async function runLookup() {
    const res = await fetch(`/api/community/scam?lookup=${encodeURIComponent(lookup)}`);
    setMatches(res.ok ? ((await res.json()).data as ScamReportView[]) : []);
  }

  function Card({ r }: { r: ScamReportView }) {
    return (
      <div className="card card--pad" style={{ padding: 14 }}>
        <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>••••{r.phoneLast4 ?? "????"} <span className="muted" style={{ fontWeight: 400 }}>· {r.mine ? "you" : r.reporterName}</span></div>
            <div style={{ fontSize: "var(--fs-small)", marginTop: 2 }}>{r.reason}</div>
            {r.evidenceNote && <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>Evidence: {r.evidenceNote}</div>}
            <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>Reported {r.createdAt}{r.expiresAt ? ` · expires ${r.expiresAt}` : ""}</div>
          </div>
          <span className={`badge ${STATUS_CLS[r.status]}`}>{r.status}</span>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          {r.mine && r.status === "submitted" && <button className="btn btn--primary btn--sm" onClick={() => act(r.id, "verify")}>Verify &amp; share</button>}
          {r.status !== "disputed" && <button className="btn btn--ghost btn--sm" onClick={() => act(r.id, "dispute")}>Dispute</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Lookup */}
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="h3" style={{ marginBottom: 8 }}>Check a number</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Phone number" />
          <button className="btn btn--primary btn--sm" onClick={runLookup} disabled={!lookup.trim()}>Check</button>
        </div>
        {matches && (
          matches.length === 0
            ? <div className="badge badge--good" style={{ marginTop: 10 }}>No matches in your network</div>
            : <div className="col" style={{ gap: 8, marginTop: 10 }}>{matches.map((m) => <Card key={m.id} r={m} />)}</div>
        )}
      </div>

      {/* Report */}
      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="h3" style={{ marginBottom: 10 }}>Report a scam number</div>
        <div className="form-grid" style={{ gap: 12 }}>
          <div><label className="field-label">Phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Stored hashed — not shared raw" /></div>
          <div><label className="field-label">Reason</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened" /></div>
          <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Evidence (required to share)</label><textarea className="textarea" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Screenshot ref, invoice, complaint no." style={{ minHeight: 52 }} /></div>
        </div>
        {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 8 }}>{error}</p>}
        <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 8 }}>
          A report is private until you verify it. Only verified reports are shared with peers you enable scam sharing for (Trusted network), and they expire automatically.
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 12 }} onClick={report} disabled={busy || !phone.trim() || !reason.trim()}>
          {busy ? "Saving…" : "File report"}
        </button>
      </div>

      {/* My reports */}
      <div className="spread" style={{ marginBottom: 8 }}>
        <div className="setgroup__label" style={{ margin: 0 }}>Your reports</div>
        {mine.length > 0 && <a className="btn btn--ghost btn--sm" href="/api/community/scam/export.csv" download>Export CSV</a>}
      </div>
      {mine.length === 0 ? <div className="empty" style={{ marginBottom: 14 }}>No reports yet.</div> : (
        <div className="col" style={{ gap: 8, marginBottom: 14 }}>{mine.map((r) => <Card key={r.id} r={r} />)}</div>
      )}

      {/* Shared with me */}
      <div className="setgroup__label">Shared by your network</div>
      {shared.length === 0 ? <div className="empty">No shared reports yet.</div> : (
        <div className="col" style={{ gap: 8 }}>{shared.map((r) => <Card key={r.id} r={r} />)}</div>
      )}
    </div>
  );
}
