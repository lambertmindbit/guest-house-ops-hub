"use client";

import { useEffect, useState } from "react";

// Registers the service worker (offline shell + fallback) and shows a banner when
// the device goes offline, so staff know data may be out of date. No offline
// writes — a booking made offline couldn't be conflict-checked.
export function PwaRuntime() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60,
        background: "var(--warn-bg, #92400e)", color: "var(--warn-text, #fff)",
        textAlign: "center", padding: "8px 12px", fontSize: 13, fontWeight: 600,
      }}
    >
      You’re offline — showing the last loaded data.
    </div>
  );
}
