"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { send, ErrorLine, AddButton, ListItem, RowActions, type Agent } from "./shared";
import { paiseToRupees } from "@/lib/money";

const BLANK = { name: "", phone: "", commissionPct: "10", notes: "" };
// commissionThisMonth is paise (GAP-9); display in whole rupees.
const rupee = (n: number) => `₹${Math.round(paiseToRupees(n)).toLocaleString("en-IN")}`;

// Travel agents (G3): the owner's inbound B2B agents and what they're owed.
// Commission is derived from bookings attributed to the agent — shown here per
// agent for the current month, never stored.
export function AgentsSection({ agents }: { agents: Agent[] }) {
  const router = useRouter();
  const { confirm, alert } = useConfirm();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(a: Agent) {
    setError(null); setAdding(false); setEditing(a.id);
    setDraft({ name: a.name, phone: a.phone ?? "", commissionPct: String(a.commissionPct), notes: a.notes ?? "" });
  }
  function startAdd() { setError(null); setEditing(null); setDraft(BLANK); setAdding(true); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const payload = {
      name: draft.name.trim(),
      phone: draft.phone.trim() || (editing ? null : undefined),
      commissionPct: Number(draft.commissionPct),
      notes: draft.notes.trim() || (editing ? null : undefined),
    };
    const r = editing ? await send("PATCH", `/api/agents/${editing}`, payload) : await send("POST", "/api/agents", payload);
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setEditing(null); setAdding(false); router.refresh();
  }

  async function patch(a: Agent, body: Record<string, unknown>) {
    const r = await send("PATCH", `/api/agents/${a.id}`, body);
    if (!r.ok) return void alert({ title: "Couldn’t complete that", message: r.error });
    router.refresh();
  }

  async function remove(a: Agent) {
    if (!(await confirm({ title: "Delete agent", message: `Delete “${a.name}”?`, danger: true, confirmLabel: "Delete" }))) return;
    const r = await send("DELETE", `/api/agents/${a.id}`);
    // An agent with bookings can't be deleted (409) — offer to deactivate instead.
    if (!r.ok) return void alert({ title: "Couldn’t delete", message: r.error });
    router.refresh();
  }

  const formOpen = adding || editing !== null;

  return (
    <>
      <AddButton label="Add travel agent" onClick={startAdd} />
      <div className="col" style={{ gap: 10 }}>
        {agents.map((a) => (
          <ListItem
            key={a.id}
            title={`${a.name}${a.verified ? " ✓" : ""}${a.active ? "" : " · inactive"}`}
            meta={[
              `${a.commissionPct}% commission`,
              a.phone || null,
              `${a.resCount} booking${a.resCount === 1 ? "" : "s"}`,
              a.commissionThisMonth > 0 ? `${rupee(a.commissionThisMonth)} owed this month` : null,
            ].filter(Boolean).join(" · ")}
            actions={
              <RowActions
                onEdit={() => startEdit(a)}
                onDelete={() => remove(a)}
              />
            }
          />
        ))}
        {agents.length === 0 && <div className="empty">No travel agents yet. Add the agents who bring you bookings on a B2B rate.</div>}
      </div>

      {formOpen && (
        <form onSubmit={submit} className="card card--pad" style={{ marginTop: 12 }}>
          <div className="h3" style={{ marginBottom: 10 }}>{editing ? "Edit agent" : "New travel agent"}</div>
          <ErrorLine msg={error} />
          <div className="form-grid">
            <div><label className="field-label">Name <span className="req">*</span></label><input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><label className="field-label">Phone</label><input className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
            <div><label className="field-label">Commission %</label><input className="input" required type="number" min="0" max="100" step="0.01" value={draft.commissionPct} onChange={(e) => setDraft({ ...draft, commissionPct: e.target.value })} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Notes</label><input className="input" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => { setEditing(null); setAdding(false); }} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
          {editing && (
            <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              {(() => {
                const a = agents.find((x) => x.id === editing);
                if (!a) return null;
                return (
                  <>
                    <button type="button" onClick={() => patch(a, { verified: !a.verified })} className="btn btn--ghost btn--sm">{a.verified ? "Mark unverified" : "Mark verified"}</button>
                    <button type="button" onClick={() => patch(a, { active: !a.active })} className="btn btn--ghost btn--sm">{a.active ? "Deactivate" : "Reactivate"}</button>
                  </>
                );
              })()}
            </div>
          )}
        </form>
      )}
    </>
  );
}
