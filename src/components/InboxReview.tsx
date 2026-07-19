"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Icon, ChannelBadge, EmptyState } from "@/components/ui";

type Linked = { guestName: string; checkIn: string; checkOut: string; amount: number | null; status: string };
type Item = {
  id: string;
  source: string;
  emailKind: "new" | "modification" | "cancellation";
  otaRef: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  roomTypeHint: string;
  amount: number | null;
  rawText: string;
  linked: Linked | null;
};
type Room = { id: string; label: string; roomTypeName: string };
type Channel = { id: string; name: string };

export function InboxReview({ data }: { data: { items: Item[]; rooms: Room[]; channels: Channel[] } }) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  async function parse(e: React.FormEvent) {
    e.preventDefault();
    if (!raw.trim()) return;
    setBusy(true);
    await fetch("/api/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    setBusy(false);
    setRaw("");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={parse} className="card" style={{ padding: 16, marginTop: 16 }}>
        <label className="field-label">Paste a confirmation email</label>
        <textarea
          className="textarea"
          rows={5}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Copy the whole OTA confirmation email and paste it here…"
        />
        <p style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)", margin: "8px 0 0", lineHeight: 1.5 }}>
          Parsing is best-effort — you&apos;ll confirm every field before a booking is created. Nothing is booked automatically.
        </p>
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={busy || !raw.trim()} className="btn btn--primary btn--sm">
            {busy ? "Parsing…" : "Parse email"}
          </button>
        </div>
      </form>

      <div className="row" style={{ justifyContent: "space-between", margin: "28px 0 14px" }}>
        <span style={{ fontWeight: 700, fontSize: "var(--fs-h3)" }}>Pending review <span style={{ color: "var(--text-subtle)", fontWeight: 600 }}>({data.items.length})</span></span>
      </div>

      {data.items.length === 0 ? (
        <EmptyState>Nothing waiting. Paste a confirmation email above to stage a booking.</EmptyState>
      ) : (
        <div className="col" style={{ gap: 14 }}>
          {data.items.map((item) =>
            item.emailKind !== "new" && item.linked ? (
              <ChangeCard key={item.id} item={item} linked={item.linked} />
            ) : (
              <ReviewCard key={item.id} item={item} rooms={data.rooms} channels={data.channels} />
            ),
          )}
        </div>
      )}
    </>
  );
}

function ReviewCard({ item, rooms, channels }: { item: Item; rooms: Room[]; channels: Channel[] }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const matchedChannel = channels.find((c) => c.name.toLowerCase() === item.source.toLowerCase());
  const [f, setF] = useState({
    channelId: matchedChannel?.id ?? "",
    roomId: "",
    guestName: item.guestName,
    guestPhone: item.guestPhone,
    checkIn: item.checkIn,
    checkOut: item.checkOut,
    amount: item.amount != null ? String(item.amount) : "",
    otaRef: item.otaRef,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function createBooking() {
    setError(null);
    if (!f.roomId || !f.channelId || !f.checkIn || !f.checkOut || !f.guestName.trim() || !f.guestPhone.trim()) {
      setError("Room, channel, dates, guest name and phone are all required.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomId: f.roomId,
        channelId: f.channelId,
        checkIn: f.checkIn,
        checkOut: f.checkOut,
        otaRef: f.otaRef || undefined,
        guest: { name: f.guestName, phone: f.guestPhone },
        grossAmount: f.amount ? Number(f.amount) : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(json.error ?? "Could not create the booking.");
      return;
    }
    await fetch(`/api/inbound/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "imported", reservationId: json.data.id }),
    });
    setBusy(false);
    router.refresh();
  }

  async function dismiss() {
    if (!(await confirm({ title: "Dismiss email", message: "Dismiss this parsed email? It won’t become a booking.", danger: true, confirmLabel: "Dismiss" }))) return;
    await fetch(`/api/inbound/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <ChannelBadge name={item.source} />
          {item.otaRef && <span style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)" }}>Ref {item.otaRef}</span>}
        </div>
        {item.roomTypeHint && <span style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)" }}>“{item.roomTypeHint}”</span>}
      </div>

      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", margin: "0 0 10px" }}>{error}</p>}

      <div className="form-grid" style={{ gap: 12 }}>
        <div>
          <label className="field-label">Guest name</label>
          <input className="input" value={f.guestName} onChange={(e) => set("guestName", e.target.value)} placeholder="Required" />
        </div>
        <div>
          <label className="field-label">Phone</label>
          <input className="input" value={f.guestPhone} onChange={(e) => set("guestPhone", e.target.value)} placeholder="Required" />
        </div>
        <div>
          <label className="field-label">Channel</label>
          <select className="select" value={f.channelId} onChange={(e) => set("channelId", e.target.value)}>
            <option value="">Select…</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Room</label>
          <select className="select" value={f.roomId} onChange={(e) => set("roomId", e.target.value)}>
            <option value="">Pick a room…</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.label} · {r.roomTypeName}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Check-in</label>
          <input className="input" type="date" value={f.checkIn} onChange={(e) => set("checkIn", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Check-out</label>
          <input className="input" type="date" value={f.checkOut} onChange={(e) => set("checkOut", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Amount (₹)</label>
          <input className="input" inputMode="numeric" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" />
        </div>
      </div>

      <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={createBooking} disabled={busy} className="btn btn--primary btn--sm">
          <Icon name="check" size={16} /> {busy ? "Creating…" : "Create booking"}
        </button>
        <button onClick={dismiss} disabled={busy} className="btn btn--ghost btn--sm">Dismiss</button>
        <button onClick={() => setShowRaw((s) => !s)} type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }}>
          {showRaw ? "Hide" : "Show"} email
        </button>
      </div>

      {showRaw && (
        <pre style={{ marginTop: 12, padding: 12, background: "var(--surface-2)", borderRadius: 8, fontSize: "var(--fs-meta)", whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>{item.rawText}</pre>
      )}
    </div>
  );
}

function DiffRow({ label, from, to }: { label: string; from: string; to: string }) {
  const changed = from !== to;
  return (
    <div className="row" style={{ gap: 8, padding: "4px 0", fontSize: "var(--fs-small)", alignItems: "center" }}>
      <span style={{ width: 84, color: "var(--text-subtle)", flex: "none" }}>{label}</span>
      <span style={{ textDecoration: changed ? "line-through" : "none", color: changed ? "var(--text-subtle)" : "var(--ink)" }}>{from || "—"}</span>
      {changed && <><Icon name="arrowR" size={13} /><b>{to || "—"}</b></>}
    </div>
  );
}

// A matched modification/cancellation: show the diff and Apply it through the
// normal conflict-checked path (GAP-2).
function ChangeCard({ item, linked }: { item: Item; linked: Linked }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCancel = item.emailKind === "cancellation";
  const money = (n: number | null) => (n != null ? `₹${n.toLocaleString("en-IN")}` : "—");
  // Effective new values mirror the Apply route: an unspecified field keeps the current one.
  const newCheckIn = item.checkIn || linked.checkIn;
  const newCheckOut = item.checkOut || linked.checkOut;
  const newAmount = item.amount != null ? item.amount : linked.amount;

  async function apply() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/inbound/${item.id}/apply`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "Could not apply this change."); return; }
    router.refresh();
  }

  async function dismiss() {
    if (!(await confirm({ title: "Dismiss", message: "Dismiss this change? The booking won’t be updated.", danger: true, confirmLabel: "Dismiss" }))) return;
    await fetch(`/api/inbound/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "dismissed" }) });
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 16, borderLeft: `4px solid ${isCancel ? "var(--red-text)" : "var(--amber-text, #b45309)"}` }}>
      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <ChannelBadge name={item.source} />
        <span className={`badge ${isCancel ? "badge--danger" : "badge--warn"}`}>{isCancel ? "Cancellation" : "Modification"}</span>
        {item.otaRef && <span style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)" }}>Ref {item.otaRef}</span>}
      </div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{linked.guestName}</div>

      {isCancel ? (
        <p className="help-a" style={{ margin: 0 }}>The OTA cancelled this booking ({linked.checkIn} → {linked.checkOut}). Applying cancels it here and frees the dates.</p>
      ) : (
        <div style={{ margin: "4px 0" }}>
          <DiffRow label="Check-in" from={linked.checkIn} to={newCheckIn} />
          <DiffRow label="Check-out" from={linked.checkOut} to={newCheckOut} />
          <DiffRow label="Amount" from={money(linked.amount)} to={money(newAmount)} />
        </div>
      )}

      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", margin: "8px 0 0" }}>{error}</p>}

      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <button onClick={apply} disabled={busy} className={`btn btn--sm ${isCancel ? "btn--danger" : "btn--primary"}`}>
          <Icon name="check" size={16} /> {busy ? "Applying…" : isCancel ? "Apply cancellation" : "Apply changes"}
        </button>
        <button onClick={dismiss} disabled={busy} className="btn btn--ghost btn--sm">Dismiss</button>
      </div>
    </div>
  );
}
