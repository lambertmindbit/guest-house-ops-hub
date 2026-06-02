"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionLabel, StatusPill, Icon } from "@/components/ui";

type RoomType = {
  id: string;
  name: string;
  baseRate: number;
  maxOccupancy: number;
  rateFloor: number;
  rateCeiling: number;
  roomCount: number;
};
type Room = { id: string; label: string; roomTypeId: string; roomTypeName: string; archived: boolean };
type Channel = { id: string; name: string; commissionPct: number; collectsPayment: boolean; resCount: number };
type Block = { id: string; roomId: string; roomLabel: string; startDate: string; endDate: string; reason: string | null };
type Settings = {
  name: string;
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  timezone: string;
  address: string | null;
  gstNumber: string | null;
} | null;

export type SettingsData = {
  settings: Settings;
  roomTypes: RoomType[];
  rooms: Room[];
  channels: Channel[];
  blocks: Block[];
};

async function send(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Something went wrong." };
}

export function SettingsClient({ data }: { data: SettingsData }) {
  const activeRooms = data.rooms.filter((r) => !r.archived);
  return (
    <div className="col" style={{ gap: 4 }}>
      <PropertySection settings={data.settings} />
      <RoomTypesSection types={data.roomTypes} />
      <RoomsSection rooms={data.rooms} types={data.roomTypes} />
      <ChannelsSection channels={data.channels} />
      <BlocksSection blocks={data.blocks} rooms={activeRooms} />
    </div>
  );
}

function ErrorLine({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p style={{ color: "var(--danger-700)", fontSize: 13, margin: "0 0 10px" }}>{msg}</p>;
}

/* ---------------- Property ---------------- */
function PropertySection({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: settings?.name ?? "My Guest House",
    address: settings?.address ?? "",
    gstNumber: settings?.gstNumber ?? "",
    checkInTime: settings?.checkInTime ?? "14:00",
    checkOutTime: settings?.checkOutTime ?? "11:00",
    currency: settings?.currency ?? "INR",
    timezone: settings?.timezone ?? "Asia/Kolkata",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await send("PATCH", "/api/settings", {
      ...f,
      address: f.address || null,
      gstNumber: f.gstNumber || null,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setSaved(true);
    router.refresh();
  }

  return (
    <section>
      <SectionLabel>Property</SectionLabel>
      <form onSubmit={save} className="card" style={{ padding: 16 }}>
        <ErrorLine msg={error} />
        <div className="form-grid" style={{ gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Property name</label>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Address</label>
            <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Used on invoices" />
          </div>
          <div>
            <label className="field-label">Check-in time</label>
            <input className="input" type="time" value={f.checkInTime} onChange={(e) => setF({ ...f, checkInTime: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Check-out time</label>
            <input className="input" type="time" value={f.checkOutTime} onChange={(e) => setF({ ...f, checkOutTime: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Currency</label>
            <input className="input" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} />
          </div>
          <div>
            <label className="field-label">GST number</label>
            <input className="input" value={f.gstNumber} onChange={(e) => setF({ ...f, gstNumber: e.target.value })} placeholder="Optional" />
          </div>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save property"}</button>
          {saved && <span style={{ fontSize: 13, color: "var(--good-700)" }}>Saved ✓</span>}
        </div>
      </form>
    </section>
  );
}

/* ---------------- Room types ---------------- */
const BLANK_TYPE = { name: "", baseRate: "", maxOccupancy: "2", rateFloor: "", rateCeiling: "" };

function RoomTypesSection({ types }: { types: RoomType[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(BLANK_TYPE);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(t: RoomType) {
    setError(null);
    setAdding(false);
    setEditing(t.id);
    setDraft({
      name: t.name,
      baseRate: String(t.baseRate),
      maxOccupancy: String(t.maxOccupancy),
      rateFloor: String(t.rateFloor),
      rateCeiling: String(t.rateCeiling),
    });
  }
  function startAdd() {
    setError(null);
    setEditing(null);
    setDraft(BLANK_TYPE);
    setAdding(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name: draft.name,
      baseRate: Number(draft.baseRate),
      maxOccupancy: Number(draft.maxOccupancy),
      rateFloor: Number(draft.rateFloor),
      rateCeiling: Number(draft.rateCeiling),
    };
    const r = editing
      ? await send("PATCH", `/api/room-types/${editing}`, payload)
      : await send("POST", "/api/room-types", payload);
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setEditing(null);
    setAdding(false);
    router.refresh();
  }

  async function remove(t: RoomType) {
    if (!confirm(`Delete room type "${t.name}"?`)) return;
    const r = await send("DELETE", `/api/room-types/${t.id}`);
    if (!r.ok) return alert(r.error);
    router.refresh();
  }

  const formOpen = adding || editing !== null;

  return (
    <section>
      <SectionLabel count={`(${types.length})`} action={<button onClick={startAdd} className="btn btn--outline btn--sm">+ Add type</button>}>
        Room types
      </SectionLabel>
      <div className="col" style={{ gap: 10 }}>
        {types.map((t) => (
          <div key={t.id} className="card" style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--subtle)", marginTop: 3 }}>
                  ₹{t.baseRate} base · sleeps {t.maxOccupancy} · floor ₹{t.rateFloor} / ceiling ₹{t.rateCeiling} · {t.roomCount} room{t.roomCount === 1 ? "" : "s"}
                </div>
              </div>
              <div className="row" style={{ gap: 6, flex: "none" }}>
                <button onClick={() => startEdit(t)} className="btn btn--ghost btn--sm">Edit</button>
                <button onClick={() => remove(t)} className="btn btn--danger-outline btn--sm">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {formOpen && (
        <form onSubmit={submit} className="card" style={{ padding: 16, marginTop: 12, borderColor: "var(--teal-300, var(--line))" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{editing ? "Edit room type" : "New room type"}</div>
          <ErrorLine msg={error} />
          <div className="form-grid" style={{ gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Name</label>
              <input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Deluxe" />
            </div>
            <div>
              <label className="field-label">Base rate (₹)</label>
              <input className="input" required type="number" min="0" value={draft.baseRate} onChange={(e) => setDraft({ ...draft, baseRate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Max occupancy</label>
              <input className="input" required type="number" min="1" value={draft.maxOccupancy} onChange={(e) => setDraft({ ...draft, maxOccupancy: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Rate floor (₹)</label>
              <input className="input" required type="number" min="0" value={draft.rateFloor} onChange={(e) => setDraft({ ...draft, rateFloor: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Rate ceiling (₹)</label>
              <input className="input" required type="number" min="0" value={draft.rateCeiling} onChange={(e) => setDraft({ ...draft, rateCeiling: e.target.value })} />
            </div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => { setEditing(null); setAdding(false); }} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

/* ---------------- Rooms ---------------- */
function RoomsSection({ rooms, types }: { rooms: Room[]; types: RoomType[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [roomTypeId, setRoomTypeId] = useState(types[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await send("POST", "/api/rooms", { label, roomTypeId });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setLabel("");
    setAdding(false);
    router.refresh();
  }

  async function setArchived(room: Room, archived: boolean) {
    const r = await send("PATCH", `/api/rooms/${room.id}`, { archived });
    if (!r.ok) return alert(r.error);
    router.refresh();
  }

  async function remove(room: Room) {
    if (!confirm(`Delete room "${room.label}"? Only possible if it has no bookings.`)) return;
    const r = await send("DELETE", `/api/rooms/${room.id}`);
    if (!r.ok) return alert(r.error);
    router.refresh();
  }

  return (
    <section>
      <SectionLabel count={`(${rooms.filter((r) => !r.archived).length})`} action={<button onClick={() => { setAdding(!adding); setError(null); }} className="btn btn--outline btn--sm">+ Add room</button>}>
        Rooms
      </SectionLabel>

      {adding && (
        <form onSubmit={add} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <ErrorLine msg={error} />
          <div className="form-grid" style={{ gap: 12 }}>
            <div>
              <label className="field-label">Label</label>
              <input className="input" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 302" />
            </div>
            <div>
              <label className="field-label">Room type</label>
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
          <div key={room.id} className="card" style={{ padding: 14, opacity: room.archived ? 0.65 : 1 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Room {room.label}</span>
                <span style={{ fontSize: 12.5, color: "var(--subtle)" }}>{room.roomTypeName}</span>
                {room.archived && <StatusPill kind="ink">Archived</StatusPill>}
              </div>
              <div className="row" style={{ gap: 6, flex: "none" }}>
                {room.archived ? (
                  <button onClick={() => setArchived(room, false)} className="btn btn--ghost btn--sm">Unarchive</button>
                ) : (
                  <button onClick={() => setArchived(room, true)} className="btn btn--ghost btn--sm">Archive</button>
                )}
                <button onClick={() => remove(room)} className="btn btn--danger-outline btn--sm">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Channels ---------------- */
const BLANK_CHANNEL = { name: "", commissionPct: "0", collectsPayment: false };

function ChannelsSection({ channels }: { channels: Channel[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK_CHANNEL);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(c: Channel) {
    setError(null);
    setAdding(false);
    setEditing(c.id);
    setDraft({ name: c.name, commissionPct: String(c.commissionPct), collectsPayment: c.collectsPayment });
  }
  function startAdd() {
    setError(null);
    setEditing(null);
    setDraft(BLANK_CHANNEL);
    setAdding(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { name: draft.name, commissionPct: Number(draft.commissionPct), collectsPayment: draft.collectsPayment };
    const r = editing
      ? await send("PATCH", `/api/channels/${editing}`, payload)
      : await send("POST", "/api/channels", payload);
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setEditing(null);
    setAdding(false);
    router.refresh();
  }

  async function remove(c: Channel) {
    if (!confirm(`Delete channel "${c.name}"?`)) return;
    const r = await send("DELETE", `/api/channels/${c.id}`);
    if (!r.ok) return alert(r.error);
    router.refresh();
  }

  const formOpen = adding || editing !== null;

  return (
    <section>
      <SectionLabel count={`(${channels.length})`} action={<button onClick={startAdd} className="btn btn--outline btn--sm">+ Add channel</button>}>
        Channels
      </SectionLabel>
      <div className="col" style={{ gap: 10 }}>
        {channels.map((c) => (
          <div key={c.id} className="card" style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--subtle)", marginTop: 3 }}>
                  {c.commissionPct}% commission · {c.collectsPayment ? "collects payment" : "you collect"} · {c.resCount} booking{c.resCount === 1 ? "" : "s"}
                </div>
              </div>
              <div className="row" style={{ gap: 6, flex: "none" }}>
                <button onClick={() => startEdit(c)} className="btn btn--ghost btn--sm">Edit</button>
                <button onClick={() => remove(c)} className="btn btn--danger-outline btn--sm">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {formOpen && (
        <form onSubmit={submit} className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{editing ? "Edit channel" : "New channel"}</div>
          <ErrorLine msg={error} />
          <div className="form-grid" style={{ gap: 12 }}>
            <div>
              <label className="field-label">Name</label>
              <input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Commission %</label>
              <input className="input" required type="number" min="0" max="100" step="0.01" value={draft.commissionPct} onChange={(e) => setDraft({ ...draft, commissionPct: e.target.value })} />
            </div>
            <div className="row" style={{ gap: 8, gridColumn: "1 / -1" }}>
              <input id="collects" type="checkbox" checked={draft.collectsPayment} onChange={(e) => setDraft({ ...draft, collectsPayment: e.target.checked })} />
              <label htmlFor="collects" style={{ fontSize: 13.5 }}>This channel collects payment from the guest</label>
            </div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => { setEditing(null); setAdding(false); }} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

/* ---------------- Blocks (maintenance) ---------------- */
function BlocksSection({ blocks, rooms }: { blocks: Block[]; rooms: Room[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ roomId: "", startDate: "", endDate: "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await send("POST", "/api/blocks", {
      roomId: f.roomId,
      startDate: f.startDate,
      endDate: f.endDate,
      reason: f.reason || undefined,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setF({ roomId: "", startDate: "", endDate: "", reason: "" });
    setAdding(false);
    router.refresh();
  }

  async function remove(b: Block) {
    if (!confirm(`Remove the block on Room ${b.roomLabel}?`)) return;
    const r = await send("DELETE", `/api/blocks/${b.id}`);
    if (!r.ok) return alert(r.error);
    router.refresh();
  }

  return (
    <section>
      <SectionLabel count={`(${blocks.length})`} action={<button onClick={() => { setAdding(!adding); setError(null); }} className="btn btn--outline btn--sm">+ Block a room</button>}>
        Maintenance blocks
      </SectionLabel>
      <p style={{ fontSize: 13, color: "var(--subtle)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Hold a room out of service (repairs, deep clean, owner use). Blocked dates can&apos;t be booked and show on the calendar.
      </p>

      {adding && (
        <form onSubmit={add} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <ErrorLine msg={error} />
          <div className="form-grid" style={{ gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Room</label>
              <select className="select" required value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>
                <option value="">Choose a room…</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.label} · {r.roomTypeName}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">From</label>
              <input className="input" required type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">To (checkout day)</label>
              <input className="input" required type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Comment / reason</label>
              <input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Plumbing repair" />
            </div>
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
            <div key={b.id} className="card" style={{ padding: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>Room {b.roomLabel}</div>
                  <div style={{ fontSize: 12.5, color: "var(--subtle)", marginTop: 3 }}>
                    {b.startDate} → {b.endDate}{b.reason ? ` · ${b.reason}` : ""}
                  </div>
                </div>
                <button onClick={() => remove(b)} className="btn btn--danger-outline btn--sm" style={{ flex: "none" }}>
                  <Icon name="x" size={15} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
