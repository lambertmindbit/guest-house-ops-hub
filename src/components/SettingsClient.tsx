"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill, Icon, PageHead } from "@/components/ui";

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

type Policy = {
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
type Season = { id: string; name: string; startDate: string; endDate: string; adjustPct: number };

export type SettingsData = {
  settings: Settings;
  roomTypes: RoomType[];
  rooms: Room[];
  channels: Channel[];
  blocks: Block[];
  policy: Policy;
  seasons: Season[];
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

// Settings is a menu (iOS-style) rather than one long scroll: pick a category,
// see only that section, with a back link. The active section lives in the URL
// (?s=…) so deep links and the browser Back button work.
const SECTIONS = [
  { key: "property", title: "Property", sub: "Name, address, GST, check-in/out times", icon: "settings" },
  { key: "rooms", title: "Rooms", sub: "Add, edit, archive rooms", icon: "door" },
  { key: "room-types", title: "Room types", sub: "Categories, rates, occupancy", icon: "bed" },
  { key: "channels", title: "Channels", sub: "Booking sources & commission", icon: "link" },
  { key: "pricing", title: "Pricing rules", sub: "Weekend, season, lead-time, occupancy", icon: "tag" },
  { key: "blocks", title: "Maintenance blocks", sub: "Hold rooms out of service", icon: "alert" },
] as const;

export type SettingsSectionKey = (typeof SECTIONS)[number]["key"];

const chipStyle = {
  width: 38, height: 38, borderRadius: 10, background: "var(--teal-50)", color: "var(--teal-700)",
  display: "grid", placeItems: "center", flex: "none",
} as const;

// One-at-a-time accordion. Pure client state — tapping a header expands that
// section instantly (no navigation/refetch). A `section` from the URL (?s=…)
// just sets which row starts open, so the deep links still land correctly.
export function SettingsClient({ data, section }: { data: SettingsData; section: string | null }) {
  const activeRooms = data.rooms.filter((r) => !r.archived);
  const [open, setOpen] = useState<string | null>(
    SECTIONS.some((s) => s.key === section) ? section : null,
  );

  const counts: Record<string, number | undefined> = {
    rooms: activeRooms.length,
    "room-types": data.roomTypes.length,
    channels: data.channels.length,
    blocks: data.blocks.length,
  };

  return (
    <>
      <PageHead title="Settings" sub="Tap a category to manage it." />
      <div className="col" style={{ gap: 10, marginTop: 14 }}>
        {SECTIONS.map((s) => {
          const isOpen = open === s.key;
          const c = counts[s.key];
          return (
            <div key={s.key} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => setOpen(isOpen ? null : s.key)}
                aria-expanded={isOpen}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 13,
                  padding: "14px 15px", textAlign: "left", border: 0, cursor: "pointer",
                  background: isOpen ? "var(--sand)" : "transparent",
                }}
              >
                <span style={chipStyle}><Icon name={s.icon} size={19} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 15 }}>{s.title}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--subtle)", marginTop: 2 }}>{s.sub}</span>
                </span>
                {c != null && <span className="pill pill--ink" style={{ flex: "none" }}>{c}</span>}
                <Icon name="chevronR" size={18} style={{ color: "var(--subtle)", flex: "none", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              </button>
              {isOpen && (
                <div style={{ padding: "14px 15px 16px", borderTop: "1px solid var(--line)" }}>
                  {s.key === "property" && <PropertySection settings={data.settings} />}
                  {s.key === "rooms" && <RoomsSection rooms={data.rooms} types={data.roomTypes} />}
                  {s.key === "room-types" && <RoomTypesSection types={data.roomTypes} />}
                  {s.key === "channels" && <ChannelsSection channels={data.channels} />}
                  {s.key === "pricing" && <PricingSection policy={data.policy} seasons={data.seasons} />}
                  {s.key === "blocks" && <BlocksSection blocks={data.blocks} rooms={activeRooms} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
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
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={startAdd} className="btn btn--outline btn--sm">+ Add type</button>
      </div>
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
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => { setAdding(!adding); setError(null); }} className="btn btn--outline btn--sm">+ Add room</button>
      </div>

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
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={startAdd} className="btn btn--outline btn--sm">+ Add channel</button>
      </div>
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

/* ---------------- Pricing (policy + seasons) ---------------- */
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

function PricingSection({ policy, seasons }: { policy: Policy; seasons: Season[] }) {
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
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setP({ ...p, weekendDays: next });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
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
    setSaved(true);
    router.refresh();
  }

  // Seasons sub-form
  const [adding, setAdding] = useState(false);
  const [s, setS] = useState({ name: "", startDate: "", endDate: "", adjustPct: "" });
  const [sErr, setSErr] = useState<string | null>(null);

  async function addSeason(e: React.FormEvent) {
    e.preventDefault();
    setSErr(null);
    const r = await send("POST", "/api/seasons", {
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      adjustPct: Number(s.adjustPct || 0),
    });
    if (!r.ok) return setSErr(r.error!);
    setS({ name: "", startDate: "", endDate: "", adjustPct: "" });
    setAdding(false);
    router.refresh();
  }

  async function removeSeason(id: string) {
    if (!confirm("Delete this season?")) return;
    await send("DELETE", `/api/seasons/${id}`);
    router.refresh();
  }

  return (
    <section>
      <p style={{ fontSize: 13, color: "var(--subtle)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Advisory only — these suggest a nightly rate and pre-fill new bookings. They&apos;re never pushed to OTAs.
        Every suggestion is clamped to each room type&apos;s floor/ceiling.
      </p>

      <div className="card" style={{ padding: 16 }}>
        <ErrorLine msg={error} />

        <div className="tweaks__row" style={{ padding: "2px 0 12px" }}>
          <label style={{ fontWeight: 600 }}>Pricing engine on</label>
          <button type="button" className={`switch${p.enabled ? " on" : ""}`} onClick={() => setP({ ...p, enabled: !p.enabled })} aria-label="Toggle pricing"><span /></button>
        </div>

        <div style={{ fontWeight: 700, fontSize: 13.5, margin: "6px 0 8px" }}>Weekend</div>
        <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {DAY_LABELS.map((lbl, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)} className={`btn btn--sm ${p.weekendDays.has(i) ? "btn--dark" : "btn--outline"}`} style={{ minWidth: 40, padding: "6px 0" }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ maxWidth: 220, marginBottom: 18 }}>
          <label className="field-label">Weekend adjustment %</label>
          <input className="input" type="number" value={p.weekendAdjustPct} onChange={(e) => setP({ ...p, weekendAdjustPct: e.target.value })} placeholder="e.g. 20" />
        </div>

        <div style={{ fontWeight: 700, fontSize: 13.5, margin: "0 0 8px" }}>Lead time</div>
        <div className="form-grid" style={{ gap: 12, marginBottom: 18 }}>
          <div>
            <label className="field-label">Early-bird if ≥ days out</label>
            <input className="input" type="number" min="0" value={p.leadEarlyDays} onChange={(e) => setP({ ...p, leadEarlyDays: e.target.value })} placeholder="e.g. 30" />
          </div>
          <div>
            <label className="field-label">Early-bird adjustment %</label>
            <input className="input" type="number" value={p.leadEarlyAdjustPct} onChange={(e) => setP({ ...p, leadEarlyAdjustPct: e.target.value })} placeholder="e.g. -10" />
          </div>
          <div>
            <label className="field-label">Last-minute if ≤ days out</label>
            <input className="input" type="number" min="0" value={p.leadLateDays} onChange={(e) => setP({ ...p, leadLateDays: e.target.value })} placeholder="e.g. 3" />
          </div>
          <div>
            <label className="field-label">Last-minute adjustment %</label>
            <input className="input" type="number" value={p.leadLateAdjustPct} onChange={(e) => setP({ ...p, leadLateAdjustPct: e.target.value })} placeholder="e.g. 15" />
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 13.5, margin: "0 0 8px" }}>Occupancy (high demand)</div>
        <div className="form-grid" style={{ gap: 12 }}>
          <div>
            <label className="field-label">When occupancy ≥ %</label>
            <input className="input" type="number" min="0" max="100" value={p.occupancyThresholdPct} onChange={(e) => setP({ ...p, occupancyThresholdPct: e.target.value })} placeholder="e.g. 80" />
          </div>
          <div>
            <label className="field-label">Adjustment %</label>
            <input className="input" type="number" value={p.occupancyAdjustPct} onChange={(e) => setP({ ...p, occupancyAdjustPct: e.target.value })} placeholder="e.g. 15" />
          </div>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button onClick={save} disabled={busy} className="btn btn--primary btn--sm">{busy ? "Saving…" : "Save pricing rules"}</button>
          {saved && <span style={{ fontSize: 13, color: "var(--good-700)" }}>Saved ✓</span>}
        </div>
      </div>

      {/* Seasons */}
      <div className="row" style={{ justifyContent: "space-between", margin: "20px 0 10px" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Seasons &amp; holidays <span style={{ color: "var(--subtle)", fontWeight: 600 }}>({seasons.length})</span></span>
        <button onClick={() => { setAdding(!adding); setSErr(null); }} className="btn btn--outline btn--sm">+ Add season</button>
      </div>

      {adding && (
        <form onSubmit={addSeason} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <ErrorLine msg={sErr} />
          <div className="form-grid" style={{ gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Name</label>
              <input className="input" required value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="e.g. Diwali week" />
            </div>
            <div>
              <label className="field-label">From</label>
              <input className="input" required type="date" value={s.startDate} onChange={(e) => setS({ ...s, startDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">To</label>
              <input className="input" required type="date" value={s.endDate} onChange={(e) => setS({ ...s, endDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Adjustment %</label>
              <input className="input" required type="number" value={s.adjustPct} onChange={(e) => setS({ ...s, adjustPct: e.target.value })} placeholder="e.g. 40" />
            </div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button type="submit" className="btn btn--primary btn--sm">Add season</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn--ghost btn--sm">Cancel</button>
          </div>
        </form>
      )}

      {seasons.length === 0 ? (
        <div className="empty">No seasons defined.</div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {seasons.map((season) => (
            <div key={season.id} className="card" style={{ padding: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{season.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--subtle)", marginTop: 3 }}>
                    {season.startDate} → {season.endDate} · {season.adjustPct > 0 ? "+" : ""}{season.adjustPct}%
                  </div>
                </div>
                <button onClick={() => removeSeason(season.id)} className="btn btn--danger-outline btn--sm" style={{ flex: "none" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
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
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => { setAdding(!adding); setError(null); }} className="btn btn--outline btn--sm">+ Block a room</button>
      </div>
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
