"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

export type RoomType = {
  id: string;
  name: string;
  baseRate: number;
  maxOccupancy: number;
  rateFloor: number;
  rateCeiling: number;
  roomCount: number;
};
export type Room = { id: string; label: string; roomTypeId: string; roomTypeName: string; archived: boolean };
export type Channel = { id: string; name: string; commissionPct: number; collectsPayment: boolean; resCount: number };
export type Block = { id: string; roomId: string; roomLabel: string; startDate: string; endDate: string; reason: string | null };
export type Settings = {
  name: string;
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  timezone: string;
  address: string | null;
  gstNumber: string | null;
} | null;
export type Policy = {
  enabled: boolean;
  weekendDays: number[];
  weekendAdjustPct: number;
  leadEarlyDays: number | null;
  leadEarlyAdjustPct: number | null;
  leadLateDays: number | null;
  leadLateAdjustPct: number | null;
  occupancyThresholdPct: number | null;
  occupancyAdjustPct: number | null;
};
export type Season = { id: string; name: string; startDate: string; endDate: string; adjustPct: number };

async function send(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Something went wrong." };
}

function ErrorLine({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="field-error" style={{ margin: "0 0 10px" }}>{msg}</p>;
}

function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <span className="row" style={{ gap: 4, flex: "none" }}>
      {onEdit && (
        <button className="btn btn--quiet btn--icon btn--sm" onClick={onEdit} aria-label="Edit"><Icon name="edit" size={16} /></button>
      )}
      {onDelete && (
        <button className="btn btn--quiet btn--icon btn--sm" onClick={onDelete} aria-label="Delete" style={{ color: "var(--red-text)" }}><Icon name="trash" size={16} /></button>
      )}
    </span>
  );
}

function ListItem({ title, meta, actions }: { title: string; meta: string; actions: React.ReactNode }) {
  return (
    <div className="card card--pad" style={{ padding: 14 }}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="h3" style={{ fontSize: 15 }}>{title}</div>
          <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 3 }}>{meta}</div>
        </div>
        {actions}
      </div>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
      <button onClick={onClick} className="btn btn--ghost btn--sm"><Icon name="plus" size={15} /> {label}</button>
    </div>
  );
}

/* ---------------- Property ---------------- */
export function PropertySection({ settings }: { settings: Settings }) {
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
    const r = await send("PATCH", "/api/settings", { ...f, address: f.address || null, gstNumber: f.gstNumber || null });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card card--pad">
      <ErrorLine msg={error} />
      <div className="form-grid">
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Property name <span className="req">*</span></label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="field-label">Address</label>
          <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Used on printed invoices" />
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
      <div className="field-hint" style={{ marginTop: 10 }}>Timezone: {f.timezone} — drives “today”, arrivals and the calendar.</div>
      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <button type="submit" disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save property"}</button>
        {saved && <span style={{ fontSize: "var(--fs-small)", color: "var(--green-text)", fontWeight: 600 }}>Saved</span>}
      </div>
    </form>
  );
}

/* ---------------- Room types ---------------- */
const BLANK_TYPE = { name: "", baseRate: "", maxOccupancy: "2", rateFloor: "", rateCeiling: "" };

export function RoomTypesSection({ types }: { types: RoomType[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(BLANK_TYPE);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(t: RoomType) {
    setError(null); setAdding(false); setEditing(t.id);
    setDraft({ name: t.name, baseRate: String(t.baseRate), maxOccupancy: String(t.maxOccupancy), rateFloor: String(t.rateFloor), rateCeiling: String(t.rateCeiling) });
  }
  function startAdd() { setError(null); setEditing(null); setDraft(BLANK_TYPE); setAdding(true); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const payload = { name: draft.name, baseRate: Number(draft.baseRate), maxOccupancy: Number(draft.maxOccupancy), rateFloor: Number(draft.rateFloor), rateCeiling: Number(draft.rateCeiling) };
    const r = editing ? await send("PATCH", `/api/room-types/${editing}`, payload) : await send("POST", "/api/room-types", payload);
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setEditing(null); setAdding(false); router.refresh();
  }

  async function remove(t: RoomType) {
    if (!confirm(`Delete room type "${t.name}"?`)) return;
    const r = await send("DELETE", `/api/room-types/${t.id}`);
    if (!r.ok) return alert(r.error);
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
            meta={`₹${t.baseRate} base · sleeps ${t.maxOccupancy} · ₹${t.rateFloor}–₹${t.rateCeiling} · ${t.roomCount} room${t.roomCount === 1 ? "" : "s"}`}
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

/* ---------------- Rooms ---------------- */
export function RoomsSection({ rooms, types }: { rooms: Room[]; types: RoomType[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [roomTypeId, setRoomTypeId] = useState(types[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await send("POST", "/api/rooms", { label, roomTypeId });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setLabel(""); setAdding(false); router.refresh();
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
                <span className="h3" style={{ fontSize: 15 }}>Room {room.label}</span>
                <span className="muted" style={{ fontSize: "var(--fs-meta)" }}>{room.roomTypeName}</span>
                {room.archived && <span className="badge badge--neutral">Archived</span>}
              </div>
              <span className="row" style={{ gap: 4, flex: "none" }}>
                <button onClick={() => setArchived(room, !room.archived)} className="btn btn--quiet btn--sm">{room.archived ? "Unarchive" : "Archive"}</button>
                <button onClick={() => remove(room)} className="btn btn--quiet btn--icon btn--sm" aria-label="Delete" style={{ color: "var(--red-text)" }}><Icon name="trash" size={16} /></button>
              </span>
            </div>
          </div>
        ))}
        {rooms.length === 0 && <div className="empty">No rooms yet.</div>}
      </div>
    </>
  );
}

/* ---------------- Channels ---------------- */
const BLANK_CHANNEL = { name: "", commissionPct: "0", collectsPayment: false };

export function ChannelsSection({ channels }: { channels: Channel[] }) {
  const router = useRouter();
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
    if (!confirm(`Delete channel "${c.name}"?`)) return;
    const r = await send("DELETE", `/api/channels/${c.id}`);
    if (!r.ok) return alert(r.error);
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

/* ---------------- Pricing (policy + seasons) ---------------- */
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
const BLANK_SEASON = { name: "", startDate: "", endDate: "", adjustPct: "" };

export function PricingSection({ policy, seasons }: { policy: Policy; seasons: Season[] }) {
  const router = useRouter();
  const [p, setP] = useState({
    enabled: policy.enabled,
    weekendDays: new Set(policy.weekendDays),
    weekendAdjustPct: String(policy.weekendAdjustPct),
    leadEarlyDays: policy.leadEarlyDays?.toString() ?? "",
    leadEarlyAdjustPct: policy.leadEarlyAdjustPct?.toString() ?? "",
    leadLateDays: policy.leadLateDays?.toString() ?? "",
    leadLateAdjustPct: policy.leadLateAdjustPct?.toString() ?? "",
    occupancyThresholdPct: policy.occupancyThresholdPct?.toString() ?? "",
    occupancyAdjustPct: policy.occupancyAdjustPct?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleDay(d: number) {
    const next = new Set(p.weekendDays);
    if (next.has(d)) next.delete(d); else next.add(d);
    setP({ ...p, weekendDays: next });
  }

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    const r = await send("PATCH", "/api/pricing/policy", {
      enabled: p.enabled,
      weekendDays: [...p.weekendDays].sort(),
      weekendAdjustPct: Number(p.weekendAdjustPct || 0),
      leadEarlyDays: numOrNull(p.leadEarlyDays),
      leadEarlyAdjustPct: numOrNull(p.leadEarlyAdjustPct),
      leadLateDays: numOrNull(p.leadLateDays),
      leadLateAdjustPct: numOrNull(p.leadLateAdjustPct),
      occupancyThresholdPct: numOrNull(p.occupancyThresholdPct),
      occupancyAdjustPct: numOrNull(p.occupancyAdjustPct),
    });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    setSaved(true); router.refresh();
  }

  // Seasons sub-form (now supports edit)
  const [editingSeason, setEditingSeason] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [s, setS] = useState(BLANK_SEASON);
  const [sErr, setSErr] = useState<string | null>(null);

  function startAddSeason() { setSErr(null); setEditingSeason(null); setS(BLANK_SEASON); setAdding(true); }
  function startEditSeason(season: Season) {
    setSErr(null); setAdding(false); setEditingSeason(season.id);
    setS({ name: season.name, startDate: season.startDate, endDate: season.endDate, adjustPct: String(season.adjustPct) });
  }

  async function submitSeason(e: React.FormEvent) {
    e.preventDefault();
    setSErr(null);
    const payload = { name: s.name, startDate: s.startDate, endDate: s.endDate, adjustPct: Number(s.adjustPct || 0) };
    const r = editingSeason ? await send("PATCH", `/api/seasons/${editingSeason}`, payload) : await send("POST", "/api/seasons", payload);
    if (!r.ok) return setSErr(r.error!);
    setS(BLANK_SEASON); setAdding(false); setEditingSeason(null); router.refresh();
  }
  async function removeSeason(id: string) {
    if (!confirm("Delete this season?")) return;
    await send("DELETE", `/api/seasons/${id}`);
    router.refresh();
  }

  const seasonFormOpen = adding || editingSeason !== null;

  return (
    <>
      <p className="muted" style={{ fontSize: "var(--fs-small)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Advisory only — these suggest a nightly rate and pre-fill new bookings, clamped to each room type&apos;s floor/ceiling. Never pushed to OTAs.
      </p>

      <div className="card card--pad">
        <ErrorLine msg={error} />
        <div className="spread" style={{ padding: "2px 0 14px" }}>
          <label style={{ fontWeight: 600 }}>Pricing engine</label>
          <button type="button" className={`switch${p.enabled ? " on" : ""}`} onClick={() => setP({ ...p, enabled: !p.enabled })} aria-label="Toggle pricing"><span /></button>
        </div>

        <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Weekend</div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {DAY_LABELS.map((lbl, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)} className={`chip${p.weekendDays.has(i) ? " on" : ""}`} style={{ minWidth: 42, justifyContent: "center" }}>{lbl}</button>
          ))}
        </div>
        <div style={{ maxWidth: 220, marginBottom: 18 }}>
          <label className="field-label">Weekend adjustment %</label>
          <input className="input" type="number" value={p.weekendAdjustPct} onChange={(e) => setP({ ...p, weekendAdjustPct: e.target.value })} placeholder="e.g. 20" />
        </div>

        <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Lead time</div>
        <div className="form-grid" style={{ marginBottom: 18 }}>
          <div><label className="field-label">Early-bird if ≥ days out</label><input className="input" type="number" min="0" value={p.leadEarlyDays} onChange={(e) => setP({ ...p, leadEarlyDays: e.target.value })} placeholder="e.g. 30" /></div>
          <div><label className="field-label">Early-bird adjustment %</label><input className="input" type="number" value={p.leadEarlyAdjustPct} onChange={(e) => setP({ ...p, leadEarlyAdjustPct: e.target.value })} placeholder="e.g. -10" /></div>
          <div><label className="field-label">Last-minute if ≤ days out</label><input className="input" type="number" min="0" value={p.leadLateDays} onChange={(e) => setP({ ...p, leadLateDays: e.target.value })} placeholder="e.g. 3" /></div>
          <div><label className="field-label">Last-minute adjustment %</label><input className="input" type="number" value={p.leadLateAdjustPct} onChange={(e) => setP({ ...p, leadLateAdjustPct: e.target.value })} placeholder="e.g. 15" /></div>
        </div>

        <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Occupancy — high demand</div>
        <div className="form-grid">
          <div><label className="field-label">When occupancy ≥ %</label><input className="input" type="number" min="0" max="100" value={p.occupancyThresholdPct} onChange={(e) => setP({ ...p, occupancyThresholdPct: e.target.value })} placeholder="e.g. 80" /></div>
          <div><label className="field-label">Adjustment %</label><input className="input" type="number" value={p.occupancyAdjustPct} onChange={(e) => setP({ ...p, occupancyAdjustPct: e.target.value })} placeholder="e.g. 15" /></div>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button onClick={save} disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save pricing rules"}</button>
          {saved && <span style={{ fontSize: "var(--fs-small)", color: "var(--green-text)", fontWeight: 600 }}>Saved</span>}
        </div>
      </div>

      <div className="section-label">
        <div className="section-label__l">
          <span className="section-label__t">Seasons &amp; holidays</span>
          <span className="section-label__c">{seasons.length}</span>
        </div>
        <button onClick={startAddSeason} className="section-label__a"><Icon name="plus" size={13} /> Add season</button>
      </div>

      {seasonFormOpen && (
        <form onSubmit={submitSeason} className="card card--pad" style={{ marginBottom: 12 }}>
          <div className="h3" style={{ marginBottom: 10 }}>{editingSeason ? "Edit season" : "New season"}</div>
          <ErrorLine msg={sErr} />
          <div className="form-grid">
            <div style={{ gridColumn: "1 / -1" }}><label className="field-label">Name <span className="req">*</span></label><input className="input" required value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="e.g. Diwali week" /></div>
            <div><label className="field-label">From</label><input className="input" required type="date" value={s.startDate} onChange={(e) => setS({ ...s, startDate: e.target.value })} /></div>
            <div><label className="field-label">To</label><input className="input" required type="date" value={s.endDate} onChange={(e) => setS({ ...s, endDate: e.target.value })} /></div>
            <div><label className="field-label">Adjustment %</label><input className="input" required type="number" value={s.adjustPct} onChange={(e) => setS({ ...s, adjustPct: e.target.value })} placeholder="e.g. 40" /></div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" className="btn btn--primary btn--sm">{editingSeason ? "Save season" : "Add season"}</button>
            <button type="button" onClick={() => { setAdding(false); setEditingSeason(null); }} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
        </form>
      )}

      {seasons.length === 0 ? (
        <div className="empty">No seasons defined.</div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {seasons.map((season) => (
            <ListItem
              key={season.id}
              title={season.name}
              meta={`${season.startDate} → ${season.endDate} · ${season.adjustPct > 0 ? "+" : ""}${season.adjustPct}%`}
              actions={<RowActions onEdit={() => startEditSeason(season)} onDelete={() => removeSeason(season.id)} />}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Blocks (maintenance) ---------------- */
export function BlocksSection({ blocks, rooms }: { blocks: Block[]; rooms: Room[] }) {
  const router = useRouter();
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
    if (!confirm(`Remove the block on Room ${b.roomLabel}?`)) return;
    const r = await send("DELETE", `/api/blocks/${b.id}`);
    if (!r.ok) return alert(r.error);
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
              meta={`${b.startDate} → ${b.endDate}${b.reason ? ` · ${b.reason}` : ""}`}
              actions={<button onClick={() => remove(b)} className="btn btn--quiet btn--sm" style={{ color: "var(--red-text)", flex: "none" }}><Icon name="trash" size={15} /> Remove</button>}
            />
          ))}
        </div>
      )}
    </>
  );
}
