"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

type Staff = { id: string; name: string };
type ChecklistItem = { label: string; done: boolean };

// Assignment + checklist + "mark clean" for one to-clean room. Completing marks
// the room clean (existing flow) and records who did it. Posts optimistic-ish via
// router.refresh so state stays in the DB.
export function HousekeepingTaskCard({
  roomId,
  staff,
  assigneeStaffId,
  checklist,
}: {
  roomId: string;
  staff: Staff[];
  assigneeStaffId: string | null;
  checklist: ChecklistItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<ChecklistItem[]>(checklist);
  const [assignee, setAssignee] = useState<string>(assigneeStaffId ?? "");
  const [busy, setBusy] = useState(false);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/housekeeping/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, ...body }),
    });
    setBusy(false);
    router.refresh();
  }

  function toggle(i: number) {
    const next = items.map((it, idx) => (idx === i ? { ...it, done: !it.done } : it));
    setItems(next);
    post({ assigneeStaffId: assignee || null, checklist: next });
  }

  const done = items.filter((i) => i.done).length;

  return (
    <div style={{ minWidth: 240 }}>
      <select
        className="select"
        value={assignee}
        onChange={(e) => { setAssignee(e.target.value); post({ assigneeStaffId: e.target.value || null, checklist: items }); }}
        style={{ marginBottom: 8 }}
      >
        <option value="">Unassigned…</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <div className="col" style={{ gap: 4, marginBottom: 8 }}>
        {items.map((it, i) => (
          <label key={it.label} className="row" style={{ gap: 8, fontSize: "var(--fs-small)", cursor: "pointer" }}>
            <input type="checkbox" checked={it.done} onChange={() => toggle(i)} />
            <span style={it.done ? { textDecoration: "line-through", color: "var(--text-subtle)" } : undefined}>{it.label}</span>
          </label>
        ))}
      </div>

      <div className="spread">
        <span className="faint" style={{ fontSize: "var(--fs-meta)" }}>{done}/{items.length} done</span>
        <button
          className="btn btn--success btn--sm"
          disabled={busy}
          onClick={() => post({ assigneeStaffId: assignee || null, checklist: items, complete: true, completedByStaffId: assignee || null })}
        >
          <Icon name="check" size={16} /> Mark clean
        </button>
      </div>
    </div>
  );
}
