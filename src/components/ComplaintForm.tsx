"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["maintenance", "cleanliness", "food", "noise", "staff", "billing", "other"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

// Log a new complaint. High priority also files an escalation server-side (→ /needs-you).
export function ComplaintForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("other");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("medium");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/complaints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description, category, priority, assignee: assignee.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not log the complaint.");
      return;
    }
    setDescription("");
    setAssignee("");
    setPriority("medium");
    setCategory("other");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={() => setOpen(true)}>
        + Log a complaint
      </button>
    );
  }

  return (
    <div className="card card--pad" style={{ marginTop: 14 }}>
      <div className="field">
        <label className="field-label">What happened?<span className="req"> *</span></label>
        <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Geyser not heating in Room 102" />
      </div>
      <div className="form-grid" style={{ gap: 12 }}>
        <div>
          <label className="field-label">Category</label>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Priority</label>
          <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Assign to (optional)</label>
          <input className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Staff name" />
        </div>
      </div>
      {priority === "high" && (
        <p className="field-hint" style={{ color: "var(--amber-text)" }}>High priority also files an approval on “Needs you”.</p>
      )}
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 8 }}>{error}</p>}
      <div className="row" style={{ gap: 10, marginTop: 12 }}>
        <button className="btn btn--primary btn--sm" onClick={submit} disabled={busy || !description.trim()}>{busy ? "Saving…" : "Log complaint"}</button>
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
