"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

const STATUSES = ["open", "in_progress", "resolved"] as const;
const STATUS_LABEL: Record<string, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved" };

export function ComplaintDetail({
  id,
  initial,
}: {
  id: string;
  initial: { status: (typeof STATUSES)[number]; assignee: string; resolutionNote: string; satisfaction: number | null };
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [status, setStatus] = useState(initial.status);
  const [assignee, setAssignee] = useState(initial.assignee);
  const [resolutionNote, setResolutionNote] = useState(initial.resolutionNote);
  const [satisfaction, setSatisfaction] = useState<number | null>(initial.satisfaction);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    const res = await fetch(`/api/complaints/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status,
        assignee: assignee.trim() || null,
        resolutionNote: resolutionNote.trim() || null,
        satisfaction: satisfaction ?? null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  async function remove() {
    if (!(await confirm({ title: "Delete complaint", message: "Delete this complaint permanently?", danger: true, confirmLabel: "Delete" }))) return;
    const res = await fetch(`/api/complaints/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/complaints");
  }

  return (
    <div className="card card--pad" style={{ marginTop: 16 }}>
      <label className="field-label">Status</label>
      <div className="seg" style={{ width: "100%", marginBottom: 12 }}>
        {STATUSES.map((s) => (
          <button key={s} style={{ flex: 1 }} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</button>
        ))}
      </div>

      <div className="field">
        <label className="field-label">Assigned to</label>
        <input className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Staff name" />
      </div>

      <div className="field">
        <label className="field-label">Resolution note</label>
        <textarea className="textarea" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="What was done to resolve it" />
      </div>

      <div className="field">
        <label className="field-label">Guest satisfaction (after resolution)</label>
        <div className="row" style={{ gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={`btn btn--sm ${satisfaction === n ? "btn--primary" : "btn--ghost"}`}
              onClick={() => setSatisfaction(satisfaction === n ? null : n)}>{n}</button>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 10, marginTop: 6, alignItems: "center" }}>
        <button className="btn btn--primary btn--sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        {saved && <span style={{ fontSize: "var(--fs-small)", color: "var(--green-text)" }}>Saved ✓</span>}
        <button className="btn btn--danger btn--sm" style={{ marginLeft: "auto" }} onClick={remove}>Delete</button>
      </div>
    </div>
  );
}
