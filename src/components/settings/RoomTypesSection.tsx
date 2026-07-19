"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { send, ErrorLine, AddButton, ListItem, RowActions, type RoomType } from "./shared";
import { rupeesToPaise, paiseToRupees } from "@/lib/money";

const BLANK_TYPE = { name: "", baseRate: "", maxOccupancy: "2", rateFloor: "", rateCeiling: "" };

export function RoomTypesSection({ types }: { types: RoomType[] }) {
  const router = useRouter();
  const { confirm, alert } = useConfirm();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(BLANK_TYPE);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(t: RoomType) {
    setError(null); setAdding(false); setEditing(t.id);
    // Rates arrive as paise; the fields hold rupees (GAP-9).
    setDraft({ name: t.name, baseRate: String(paiseToRupees(t.baseRate)), maxOccupancy: String(t.maxOccupancy), rateFloor: String(paiseToRupees(t.rateFloor)), rateCeiling: String(paiseToRupees(t.rateCeiling)) });
  }
  function startAdd() { setError(null); setEditing(null); setDraft(BLANK_TYPE); setAdding(true); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const payload = { name: draft.name, baseRate: rupeesToPaise(Number(draft.baseRate)), maxOccupancy: Number(draft.maxOccupancy), rateFloor: rupeesToPaise(Number(draft.rateFloor)), rateCeiling: rupeesToPaise(Number(draft.rateCeiling)) };
    const r = editing ? await send("PATCH", `/api/room-types/${editing}`, payload) : await send("POST", "/api/room-types", payload);
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setEditing(null); setAdding(false); router.refresh();
  }

  async function remove(t: RoomType) {
    if (!(await confirm({ title: "Delete room type", message: `Delete “${t.name}”? This can’t be undone.`, danger: true, confirmLabel: "Delete" }))) return;
    const r = await send("DELETE", `/api/room-types/${t.id}`);
    if (!r.ok) return void alert({ title: "Couldn’t complete that", message: r.error });
    router.refresh();
  }

  const formOpen = adding || editing !== null;

  return (
    <>
      <AddButton label="Add type" onClick={startAdd} />
      <div className="col" style={{ gap: 10 }}>
        {types.map((t) => (
          <ListItem
            key={t.id}
            title={t.name}
            meta={`₹${paiseToRupees(t.baseRate)} base · sleeps ${t.maxOccupancy} · ₹${paiseToRupees(t.rateFloor)}–₹${paiseToRupees(t.rateCeiling)} · ${t.roomCount} room${t.roomCount === 1 ? "" : "s"}`}
            actions={<RowActions onEdit={() => startEdit(t)} onDelete={() => remove(t)} />}
          />
        ))}
        {types.length === 0 && <div className="empty">No room types yet.</div>}
      </div>

      {formOpen && (
        <form onSubmit={submit} className="card card--pad" style={{ marginTop: 12 }}>
          <div className="h3" style={{ marginBottom: 10 }}>{editing ? "Edit room type" : "New room type"}</div>
          <ErrorLine msg={error} />
          <div className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Name <span className="req">*</span></label>
              <input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Deluxe" />
            </div>
            <div><label className="field-label">Base rate (₹)</label><input className="input" required type="number" min="0" value={draft.baseRate} onChange={(e) => setDraft({ ...draft, baseRate: e.target.value })} /></div>
            <div><label className="field-label">Max occupancy</label><input className="input" required type="number" min="1" value={draft.maxOccupancy} onChange={(e) => setDraft({ ...draft, maxOccupancy: e.target.value })} /></div>
            <div><label className="field-label">Rate floor (₹)</label><input className="input" required type="number" min="0" value={draft.rateFloor} onChange={(e) => setDraft({ ...draft, rateFloor: e.target.value })} /></div>
            <div><label className="field-label">Rate ceiling (₹)</label><input className="input" required type="number" min="0" value={draft.rateCeiling} onChange={(e) => setDraft({ ...draft, rateCeiling: e.target.value })} /></div>
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
