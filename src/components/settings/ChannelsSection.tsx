"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { send, ErrorLine, AddButton, ListItem, RowActions, type Channel } from "./shared";

const BLANK_CHANNEL = { name: "", commissionPct: "0", collectsPayment: false };

export function ChannelsSection({ channels }: { channels: Channel[] }) {
  const router = useRouter();
  const { confirm, alert } = useConfirm();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK_CHANNEL);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(c: Channel) {
    setError(null); setAdding(false); setEditing(c.id);
    setDraft({ name: c.name, commissionPct: String(c.commissionPct), collectsPayment: c.collectsPayment });
  }
  function startAdd() { setError(null); setEditing(null); setDraft(BLANK_CHANNEL); setAdding(true); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const payload = { name: draft.name, commissionPct: Number(draft.commissionPct), collectsPayment: draft.collectsPayment };
    const r = editing ? await send("PATCH", `/api/channels/${editing}`, payload) : await send("POST", "/api/channels", payload);
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setEditing(null); setAdding(false); router.refresh();
  }
  async function remove(c: Channel) {
    if (!(await confirm({ title: "Delete channel", message: `Delete “${c.name}”?`, danger: true, confirmLabel: "Delete" }))) return;
    const r = await send("DELETE", `/api/channels/${c.id}`);
    if (!r.ok) return void alert({ title: "Couldn’t complete that", message: r.error });
    router.refresh();
  }

  const formOpen = adding || editing !== null;

  return (
    <>
      <AddButton label="Add channel" onClick={startAdd} />
      <div className="col" style={{ gap: 10 }}>
        {channels.map((c) => (
          <ListItem
            key={c.id}
            title={c.name}
            meta={`${c.commissionPct}% commission · ${c.collectsPayment ? "collects payment" : "you collect"} · ${c.resCount} booking${c.resCount === 1 ? "" : "s"}`}
            actions={<RowActions onEdit={() => startEdit(c)} onDelete={() => remove(c)} />}
          />
        ))}
        {channels.length === 0 && <div className="empty">No channels yet.</div>}
      </div>

      {formOpen && (
        <form onSubmit={submit} className="card card--pad" style={{ marginTop: 12 }}>
          <div className="h3" style={{ marginBottom: 10 }}>{editing ? "Edit channel" : "New channel"}</div>
          <ErrorLine msg={error} />
          <div className="form-grid">
            <div><label className="field-label">Name <span className="req">*</span></label><input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><label className="field-label">Commission %</label><input className="input" required type="number" min="0" max="100" step="0.01" value={draft.commissionPct} onChange={(e) => setDraft({ ...draft, commissionPct: e.target.value })} /></div>
            <label className="row" style={{ gap: 8, gridColumn: "1 / -1", fontSize: "var(--fs-small)", cursor: "pointer" }}>
              <input type="checkbox" checked={draft.collectsPayment} onChange={(e) => setDraft({ ...draft, collectsPayment: e.target.checked })} />
              This channel collects payment from the guest
            </label>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => { setEditing(null); setAdding(false); }} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
        </form>
      )}
    </>
  );
}
