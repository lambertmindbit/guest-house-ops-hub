"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Icon } from "@/components/ui";
import { describeSyncAge, isFeedStale } from "@/lib/feed-health";

export type RoomOption = { id: string; label: string; roomTypeName: string };
export type FeedRow = {
  id: string;
  label: string;
  roomLabel: string;
  url: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export function ImportFeeds({ rooms, feeds }: { rooms: RoomOption[]; feeds: FeedRow[] }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [roomId, setRoomId] = useState("");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function addFeed(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, label, url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not add feed.");
        return;
      }
      setRoomId("");
      setLabel("");
      setUrl("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Remove feed", message: "Remove this feed and the dates it imported?", danger: true, confirmLabel: "Remove" }))) return;
    await fetch(`/api/feeds/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function syncNow() {
    setBusy(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      const results = json.data?.results ?? [];
      const total = results.reduce((n: number, r: { imported: number }) => n + r.imported, 0);
      const failed = results.filter((r: { error?: string }) => r.error).length;
      setSyncMsg(`Synced ${results.length} feed(s): ${total} dates imported${failed ? `, ${failed} failed` : ""}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: "var(--fs-h3)" }}>Import from OTAs</span>
        <button onClick={syncNow} disabled={busy} className="btn btn--primary btn--sm">
          {busy ? "Working…" : "Sync now"}
        </button>
      </div>
      <p style={{ fontSize: "var(--fs-body)", color: "var(--text-subtle)", marginBottom: 14, lineHeight: 1.5 }}>
        Paste the iCal link each OTA gives you for a room. Imported dates show as blocks on the calendar so they can&apos;t be double-booked.
      </p>

      {syncMsg && (
        <div className="banner banner--good" style={{ cursor: "default", marginBottom: 12 }}>
          <span className="banner__icon"><Icon name="check" size={18} /></span>
          <span style={{ flex: 1 }}>{syncMsg}</span>
        </div>
      )}

      <form onSubmit={addFeed} className="card" style={{ padding: 16, marginBottom: 16 }}>
        {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-body)", marginBottom: 10 }}>{error}</p>}
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div>
            <label className="field-label">Room</label>
            <select className="select" required value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Room…</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.label} · {r.roomTypeName}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Label</label>
            <input className="input" required placeholder="e.g. Booking.com" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">iCal link</label>
            <input className="input" required type="url" placeholder="https://… iCal link from the OTA" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={busy} className="btn btn--ghost btn--sm">Add feed</button>
      </form>

      {feeds.length === 0 ? (
        <div className="empty">No import feeds yet.</div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {feeds.map((f) => (
            <div key={f.id} className="card" style={{ padding: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>
                    {f.label} <span style={{ color: "var(--text-subtle)", fontWeight: 500 }}>· Room {f.roomLabel}</span>
                  </div>
                  <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.url}</div>
                  <div style={{ marginTop: 4, fontSize: "var(--fs-meta)" }}>
                    {f.lastError ? (
                      <span style={{ color: "var(--red-text)" }}>Sync failed ({describeSyncAge(f.lastSyncedAt, new Date())}): {f.lastError}</span>
                    ) : f.lastSyncedAt ? (
                      <span style={{ color: isFeedStale({ active: true, lastSyncedAt: f.lastSyncedAt, lastError: null }, new Date()) ? "var(--amber-text, #b45309)" : "var(--text-subtle)" }}>
                        Synced {describeSyncAge(f.lastSyncedAt, new Date())}
                        {isFeedStale({ active: true, lastSyncedAt: f.lastSyncedAt, lastError: null }, new Date()) ? " · stale" : ""}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-subtle)" }}>Not synced yet</span>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(f.id)} className="btn btn--danger btn--sm" style={{ flex: "none" }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
