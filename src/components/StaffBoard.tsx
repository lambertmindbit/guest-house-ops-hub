"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { SectionLabel } from "@/components/ui";

type Status = "present" | "absent" | "leave";
type Staff = { id: string; name: string; role: string | null; phone: string | null; active: boolean };
type Shift = { id: string; staffId: string; staffName: string; date: string; start: string; end: string; note: string | null };

export function StaffBoard({
  today,
  staff,
  shifts,
  attendance,
}: {
  today: string;
  staff: Staff[];
  shifts: Shift[];
  attendance: { staffId: string; status: Status }[];
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [nStaff, setNStaff] = useState({ name: "", role: "", phone: "" });
  const [nShift, setNShift] = useState({ staffId: "", date: today, start: "09:00", end: "17:00" });
  const [error, setError] = useState<string | null>(null);
  const attMap = new Map(attendance.map((a) => [a.staffId, a.status]));

  async function post(url: string, body: unknown, method = "POST") {
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  async function addStaff() {
    if (!nStaff.name.trim()) return;
    if (await post("/api/staff", { name: nStaff.name, role: nStaff.role || null, phone: nStaff.phone || null })) {
      setNStaff({ name: "", role: "", phone: "" });
    }
  }
  async function addShift() {
    if (!nShift.staffId) { setError("Pick a staff member."); return; }
    await post("/api/shifts", nShift);
  }
  async function removeStaff(id: string) {
    if (!(await confirm({ title: "Remove staff", message: "Delete this staff member and their shifts?", danger: true, confirmLabel: "Delete" }))) return;
    await post(`/api/staff/${id}`, {}, "DELETE");
  }

  const upcoming = shifts.slice(0, 40);
  const activeStaff = staff.filter((s) => s.active);

  return (
    <div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)" }}>{error}</p>}

      {/* Directory */}
      <SectionLabel count={staff.length}>Directory</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <input className="input" placeholder="Name" value={nStaff.name} onChange={(e) => setNStaff({ ...nStaff, name: e.target.value })} />
          <input className="input" placeholder="Role (e.g. Housekeeping)" value={nStaff.role} onChange={(e) => setNStaff({ ...nStaff, role: e.target.value })} />
          <input className="input" placeholder="Phone (optional)" value={nStaff.phone} onChange={(e) => setNStaff({ ...nStaff, phone: e.target.value })} />
          <button className="btn btn--primary btn--sm" onClick={addStaff} disabled={!nStaff.name.trim()}>Add staff</button>
        </div>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {staff.map((s) => (
          <div key={s.id} className="rowcard" style={{ opacity: s.active ? 1 : 0.6 }}>
            <div className="rowcard__main">
              <div className="rowcard__name">{s.name}{!s.active && " · inactive"}</div>
              <div className="rowcard__meta">{[s.role, s.phone].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => post(`/api/staff/${s.id}`, { active: !s.active }, "PATCH")}>{s.active ? "Disable" : "Enable"}</button>
              <button className="btn btn--danger btn--sm" onClick={() => removeStaff(s.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Roster */}
      <SectionLabel count={upcoming.length}>Shift roster</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <div className="form-grid" style={{ gap: 10 }}>
          <select className="select" value={nShift.staffId} onChange={(e) => setNShift({ ...nShift, staffId: e.target.value })}>
            <option value="">Staff…</option>
            {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="input" type="date" value={nShift.date} onChange={(e) => setNShift({ ...nShift, date: e.target.value })} />
          <input className="input" type="time" value={nShift.start} onChange={(e) => setNShift({ ...nShift, start: e.target.value })} />
          <input className="input" type="time" value={nShift.end} onChange={(e) => setNShift({ ...nShift, end: e.target.value })} />
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginTop: 10 }} onClick={addShift}>Add shift</button>
      </div>
      <div className="col" style={{ gap: 6 }}>
        {upcoming.length === 0 ? <div className="empty">No upcoming shifts.</div> : upcoming.map((sh) => (
          <div key={sh.id} className="rowcard">
            <div className="rowcard__main">
              <div className="rowcard__name">{sh.staffName}</div>
              <div className="rowcard__meta">{sh.date} · {sh.start}–{sh.end}{sh.note ? ` · ${sh.note}` : ""}</div>
            </div>
            <button className="btn btn--quiet btn--icon btn--sm" onClick={() => post(`/api/shifts/${sh.id}`, {}, "DELETE")} aria-label="Remove shift">✕</button>
          </div>
        ))}
      </div>

      {/* Attendance (today) */}
      <SectionLabel>Attendance · today</SectionLabel>
      <div className="col" style={{ gap: 8 }}>
        {activeStaff.length === 0 ? <div className="empty">Add staff to mark attendance.</div> : activeStaff.map((s) => {
          const cur = attMap.get(s.id);
          return (
            <div key={s.id} className="rowcard">
              <div className="rowcard__main"><div className="rowcard__name">{s.name}</div></div>
              <div className="seg">
                {(["present", "absent", "leave"] as Status[]).map((st) => (
                  <button key={st} className={cur === st ? "on" : ""} style={{ textTransform: "capitalize" }}
                    onClick={() => post("/api/attendance", { staffId: s.id, date: today, status: st })}>{st}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
