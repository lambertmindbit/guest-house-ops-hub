"use client";

import { useEffect, useState } from "react";

// "Enable notifications" control for the owner console. Subscribes this browser
// to Web Push and stores the subscription server-side; a new queue item then
// pings the phone even when the app is closed. The service worker only runs in
// production, so this is a no-op in dev.

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "busy";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!VAPID || typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setError("");
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("denied"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID as string) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Could not save subscription");
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  return (
    <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 12 }}>
      {state === "on" ? (
        <button className="btn btn--ghost btn--sm" onClick={disable}>🔔 Notifications on — turn off</button>
      ) : state === "denied" ? (
        <span className="muted" style={{ fontSize: 13 }}>Notifications are blocked in your browser settings.</span>
      ) : (
        <button className="btn btn--primary btn--sm" disabled={state === "busy"} onClick={enable}>
          {state === "busy" ? "Enabling…" : "🔔 Enable notifications"}
        </button>
      )}
      {error && <span className="muted" style={{ fontSize: 12, color: "var(--red-text, #b91c1c)" }}>{error}</span>}
    </div>
  );
}
