"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    if (!confirm("Remove this feed and the dates it imported?")) return;
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
      setSyncMsg(
        `Synced ${results.length} feed(s): ${total} dates imported${failed ? `, ${failed} failed` : ""}.`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Import from OTAs</h2>
        <button
          onClick={syncNow}
          disabled={busy}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Sync now"}
        </button>
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        Paste the iCal link each OTA gives you for a room. Imported dates show as blocks on the
        calendar so they can&apos;t be double-booked.
      </p>

      {syncMsg && (
        <p className="mb-3 rounded-lg border border-green-200 bg-green-50 p-2 text-sm text-green-700">
          {syncMsg}
        </p>
      )}

      <form onSubmit={addFeed} className="mb-4 space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            required
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className={inputClass}
          >
            <option value="">Room…</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} · {r.roomTypeName}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Label (e.g. Booking.com)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
        </div>
        <input
          required
          type="url"
          placeholder="https://… iCal link from the OTA"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          Add feed
        </button>
      </form>

      {feeds.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 p-3 text-sm text-neutral-400">
          No import feeds yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {feeds.map((f) => (
            <li key={f.id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {f.label} <span className="text-neutral-400">· Room {f.roomLabel}</span>
                  </div>
                  <div className="truncate text-xs text-neutral-500">{f.url}</div>
                  <div className="mt-1 text-xs">
                    {f.lastError ? (
                      <span className="text-red-600">Error: {f.lastError}</span>
                    ) : f.lastSyncedAt ? (
                      <span className="text-neutral-400">
                        Last synced {new Date(f.lastSyncedAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-neutral-400">Not synced yet</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(f.id)}
                  className="shrink-0 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
