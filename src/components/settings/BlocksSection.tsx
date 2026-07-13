"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmProvider";
import { send, fmtDate, ErrorLine, AddButton, ListItem, type Block, type Room } from "./shared";

export function BlocksSection({ blocks, rooms }: { blocks: Block[]; rooms: Pick<Room, "id" | "label" | "roomTypeName">[] }) {
  const router = useRouter();
  const { confirm, alert } = useConfirm();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ roomId: "", startDate: "", endDate: "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await send("POST", "/api/blocks", { roomId: f.roomId, startDate: f.startDate, endDate: f.endDate, reason: f.reason || undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setF({ roomId: "", startDate: "", endDate: "", reason: "" }); setAdding(false); router.refresh();
  }
  async function remove(b: Block) {
    if (!(await confirm({ title: "Remove block", message: `Remove the block on Room ${b.roomLabel}?`, danger: true, confirmLabel: "Remove" }))) return;
    const r = await send("DELETE", `/api/blocks/${b.id}`);
    if (!r.ok) return void alert({ title: "Couldn’t complete that", message: r.error });
    router.refresh();
  }

  return (
    <>
      <p className="muted" style={{ fontSize: "var(--fs-small)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Hold a room out of service (repairs, deep clean, owner use). Blocked dates can&apos;t be booked and show on the calendar.
      </p>
      <AddButton label="Block a room" onClick={() => { setAdding(!adding); setError(null); }} />

      {adding && (
        <form onSubmit={add} className="card card--pad" style={{ marginBottom: 12 }}>
          <ErrorLine msg={error} />
          <div className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Room <span className="req">*</span></label>
              <select className="select" required value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>
                <option value="">Choose a room…</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.label} · {r.roomTypeName}</option>)}
              </select>
            </div>
            <div><label className="field-label">From</label><input className="input" required type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
            <div><label className="field-label">To (checkout day)</label><input className="input" required type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Comment / reason</label><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Plumbing repair" /></div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Blocking…" : "Block room"}</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
        </form>
      )}

      {blocks.length === 0 ? (
        <div className="empty">No maintenance blocks.</div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {blocks.map((b) => (
            <ListItem
              key={b.id}
              title={`Room ${b.roomLabel}`}
              meta={`${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}${b.reason ? ` · ${b.reason}` : ""}`}
              actions={<button onClick={() => remove(b)} className="btn btn--quiet btn--sm" style={{ color: "var(--red-text)", flex: "none" }}><Icon name="trash" size={15} /> Remove</button>}
            />
          ))}
        </div>
      )}
    </>
  );
}
