"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ImportType = "guests" | "bookings";
type RowResult = { row: number; status: "created" | "error"; message: string };
type Result = { results: RowResult[]; created: number; errors: number };

const TEMPLATES: Record<ImportType, string> = {
  guests: "name,phone,email,address,vehicle,idnumber,notes\nAlice Doe,9990001111,alice@example.com,\"Mawlai, Shillong\",ML05 1234,AADH-1,VIP",
  bookings: "phone,name,room,channel,checkin,checkout,amount,advance,status\n9990001111,Alice Doe,101,Direct,2026-09-10,2026-09-13,3000,500,confirmed",
};

export function ImportTool() {
  const router = useRouter();
  const [type, setType] = useState<ImportType>("guests");
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(preview: boolean) {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, csv, dryRun: preview }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Import failed.");
      return;
    }
    setDryRun(preview);
    setResult(json.data as Result);
    if (!preview) router.refresh();
  }

  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATES[type])}`;

  return (
    <div className="card card--pad">
      <div className="seg" style={{ marginBottom: 12 }}>
        {(["guests", "bookings"] as ImportType[]).map((t) => (
          <button key={t} className={type === t ? "on" : ""} style={{ textTransform: "capitalize" }} onClick={() => { setType(t); setResult(null); }}>{t}</button>
        ))}
      </div>

      <p className="help-a" style={{ marginTop: 0 }}>
        Paste or upload a CSV. <a href={templateHref} download={`${type}-template.csv`}>Download the {type} template</a>.
        {type === "bookings" && " Rooms match by label, channels by name; overlapping bookings are rejected per-row."}
      </p>

      <textarea
        className="textarea"
        style={{ minHeight: 140, fontFamily: "var(--font-mono, monospace)", fontSize: "var(--fs-small)" }}
        placeholder={TEMPLATES[type]}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
      />
      <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <label className="btn btn--ghost btn--sm" style={{ cursor: "pointer" }}>
          Upload CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
        </label>
        <button className="btn btn--ghost btn--sm" disabled={busy || !csv.trim()} onClick={() => run(true)}>Preview (dry run)</button>
        <button className="btn btn--primary btn--sm" disabled={busy || !csv.trim()} onClick={() => run(false)}>Import</button>
      </div>

      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 10 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 14 }}>
          <div className="spread" style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: "var(--fs-small)" }}>
              {dryRun ? "Preview" : "Imported"} — {result.created} ok, {result.errors} error{result.errors === 1 ? "" : "s"}
            </span>
            {dryRun && result.errors === 0 && <span className="badge badge--good">Ready to import</span>}
          </div>
          <div className="col" style={{ gap: 4 }}>
            {result.results.map((r) => (
              <div key={r.row} className="spread" style={{ fontSize: "var(--fs-small)", padding: "5px 0", borderTop: "1px solid var(--border-subtle)" }}>
                <span className="muted">Row {r.row}</span>
                <span className={`badge ${r.status === "created" ? "badge--good" : "badge--danger"}`}>{r.status === "created" ? (dryRun ? "ok" : "created") : "error"}</span>
                <span style={{ flex: 1, textAlign: "right" }}>{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
