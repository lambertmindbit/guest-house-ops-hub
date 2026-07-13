"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmProvider";
import { send, ErrorLine, AddButton, type Room, type RoomType } from "./shared";

const BLANK_ROOM_CONTENT = { photos: "", facing: "", view: "" };

export function RoomsSection({ rooms, types }: { rooms: Room[]; types: RoomType[] }) {
  const router = useRouter();
  const { confirm, alert } = useConfirm();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [roomTypeId, setRoomTypeId] = useState(types[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [content, setContent] = useState(BLANK_ROOM_CONTENT);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await send("POST", "/api/rooms", { label, roomTypeId });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setLabel(""); setAdding(false); router.refresh();
  }
  function startEditContent(room: Room) {
    setError(null); setAdding(false); setEditing(room.id);
    setContent({ photos: room.photos.join("\n"), facing: room.facing ?? "", view: room.view ?? "" });
  }
  async function saveContent(e: React.FormEvent, roomId: string) {
    e.preventDefault();
    const photos = content.photos.split("\n").map((s) => s.trim()).filter(Boolean);
    setBusy(true); setError(null);
    const r = await send("PATCH", `/api/rooms/${roomId}`, {
      photos, facing: content.facing.trim() || null, view: content.view.trim() || null,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setEditing(null); router.refresh();
  }
  async function setArchived(room: Room, archived: boolean) {
    if (
      archived &&
      !(await confirm({
        title: "Archive room",
        message: `Archive Room ${room.label}? It’s hidden from the calendar and new bookings, but its history is kept — you can unarchive it anytime.`,
        confirmLabel: "Archive",
      }))
    )
      return;
    const r = await send("PATCH", `/api/rooms/${room.id}`, { archived });
    if (!r.ok) return void alert({ title: "Couldn’t complete that", message: r.error });
    router.refresh();
  }
  async function remove(room: Room) {
    if (!(await confirm({ title: "Delete room", message: `Delete Room ${room.label}? Only possible if it has no bookings.`, danger: true, confirmLabel: "Delete" }))) return;
    const r = await send("DELETE", `/api/rooms/${room.id}`);
    if (!r.ok) return void alert({ title: "Couldn’t complete that", message: r.error });
    router.refresh();
  }

  return (
    <>
      <AddButton label="Add room" onClick={() => { setAdding(!adding); setError(null); }} />
      {adding && (
        <form onSubmit={add} className="card card--pad" style={{ marginBottom: 12 }}>
          <ErrorLine msg={error} />
          <div className="form-grid">
            <div><label className="field-label">Label <span className="req">*</span></label><input className="input" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 302" /></div>
            <div>
              <label className="field-label">Room type <span className="req">*</span></label>
              <select className="select" required value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={busy || !roomTypeId} className="btn btn--primary btn--sm">{busy ? "Adding…" : "Add room"}</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
        </form>
      )}
      <div className="col" style={{ gap: 10 }}>
        {rooms.map((room) => (
          <div key={room.id} className="card card--pad" style={{ padding: 14, opacity: room.archived ? 0.65 : 1 }}>
            <div className="spread">
              <div className="row" style={{ gap: 8 }}>
                <span className="h3" style={{ fontSize: "var(--fs-h3)" }}>Room {room.label}</span>
                <span className="muted" style={{ fontSize: "var(--fs-meta)" }}>{room.roomTypeName}</span>
                {room.archived && <span className="badge badge--neutral">Archived</span>}
                {room.photos.length > 0 && <span className="badge badge--neutral">📷 {room.photos.length}</span>}
              </div>
              <span className="row" style={{ gap: 4, flex: "none" }}>
                <button onClick={() => (editing === room.id ? setEditing(null) : startEditContent(room))} className="btn btn--quiet btn--sm">{editing === room.id ? "Close" : "Edit"}</button>
                <button onClick={() => setArchived(room, !room.archived)} className="btn btn--quiet btn--sm">{room.archived ? "Unarchive" : "Archive"}</button>
                <button onClick={() => remove(room)} className="btn btn--quiet btn--icon btn--sm" aria-label="Delete" style={{ color: "var(--red-text)" }}><Icon name="trash" size={16} /></button>
              </span>
            </div>
            {(room.facing || room.view) && editing !== room.id && (
              <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 6 }}>
                {[room.facing, room.view].filter(Boolean).join(" · ")}
              </div>
            )}
            {editing === room.id && (
              <form onSubmit={(e) => saveContent(e, room.id)} style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <ErrorLine msg={error} />
                <div className="form-grid">
                  <div><label className="field-label">Facing</label><input className="input" placeholder="e.g. East" value={content.facing} onChange={(e) => setContent({ ...content, facing: e.target.value })} /></div>
                  <div><label className="field-label">View</label><input className="input" placeholder="e.g. Pool view" value={content.view} onChange={(e) => setContent({ ...content, view: e.target.value })} /></div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label className="field-label">Photos — URLs, one per line (max 8)</label>
                  <textarea className="textarea" style={{ minHeight: 60 }} placeholder="https://…" value={content.photos} onChange={(e) => setContent({ ...content, photos: e.target.value })} />
                </div>
                <div className="row" style={{ gap: 10, marginTop: 12 }}>
                  <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save"}</button>
                  <button type="button" onClick={() => setEditing(null)} className="btn btn--ghost btn--sm">Cancel</button>
                </div>
              </form>
            )}
          </div>
        ))}
        {rooms.length === 0 && <div className="empty">No rooms yet.</div>}
      </div>
    </>
  );
}
