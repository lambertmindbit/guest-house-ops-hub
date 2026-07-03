"use client";

import { useEffect, useState } from "react";

// Registers the service worker and drives the offline UX:
//   • an "offline" banner when the device drops connection,
//   • a "N changes waiting to sync" indicator for queued offline writes, and
//   • a conflict banner when a replayed write is rejected (e.g. those dates are
//     no longer available) — the server stays authoritative, nothing is applied
//     locally, so conflicts are surfaced rather than silently dropped.
export function PwaRuntime() {
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (sw) {
      // In development Next serves chunks at stable URLs whose contents change on
      // every rebuild; the cache-first SW would pin the first version and serve
      // stale chunks (the "reading 'call'" webpack error). So never run the SW in
      // dev — and unregister/clear any install left over from earlier testing so
      // an existing dev SW heals itself on the next load.
      if (process.env.NODE_ENV !== "production") {
        sw.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
        if (typeof caches !== "undefined") caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
        return;
      }
      sw.register("/sw.js").catch(() => {});
      // Ask the SW for the current queue count, and replay anything pending.
      const ping = (type: string) => sw.ready.then((reg) => reg.active?.postMessage({ type })).catch(() => {});
      ping("count");
      ping("replay");

      const onMessage = (e: MessageEvent) => {
        const d = e.data;
        if (d?.type === "offline-queue") {
          setPending(d.pending ?? 0);
          if (Array.isArray(d.conflicts) && d.conflicts.length) setConflicts((n) => n + d.conflicts.length);
        }
      };
      sw.addEventListener("message", onMessage);

      const onOnline = () => ping("replay");
      window.addEventListener("online", onOnline);

      const update = () => setOffline(!navigator.onLine);
      update();
      window.addEventListener("online", update);
      window.addEventListener("offline", update);

      return () => {
        sw.removeEventListener("message", onMessage);
        window.removeEventListener("online", onOnline);
        window.removeEventListener("online", update);
        window.removeEventListener("offline", update);
      };
    }
  }, []);

  if (!offline && pending === 0 && conflicts === 0) return null;

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, display: "grid", gap: 1 }}>
      {conflicts > 0 && (
        <button
          onClick={() => setConflicts(0)}
          style={{ border: 0, width: "100%", textAlign: "center", padding: "8px 12px", fontSize: 13, fontWeight: 600, background: "var(--red-bg, #7f1d1d)", color: "var(--red-text, #fff)" }}
        >
          {conflicts} offline change{conflicts === 1 ? "" : "s"} couldn’t be applied (dates may no longer be available). Tap to dismiss.
        </button>
      )}
      {pending > 0 && (
        <div role="status" style={{ textAlign: "center", padding: "8px 12px", fontSize: 13, fontWeight: 600, background: "var(--surface-2, #1f2937)", color: "var(--ink, #fff)" }}>
          {pending} change{pending === 1 ? "" : "s"} waiting to sync…
        </div>
      )}
      {offline && (
        <div role="status" style={{ textAlign: "center", padding: "8px 12px", fontSize: 13, fontWeight: 600, background: "var(--warn-bg, #92400e)", color: "var(--warn-text, #fff)" }}>
          You’re offline — changes are saved and will sync when you reconnect.
        </div>
      )}
    </div>
  );
}
