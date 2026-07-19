"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PushToggle } from "@/components/PushToggle";

type Prefs = { pushEscalations: boolean; pushConflicts: boolean; pushStaleSync: boolean };

const EVENTS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: "pushEscalations", label: "Urgent escalations", hint: "High-priority items the AI or front desk flags for you" },
  { key: "pushConflicts", label: "New booking conflicts", hint: "When a sync lands an OTA date on top of an existing booking" },
  { key: "pushStaleSync", label: "Sync failures", hint: "When an iCal feed stops syncing and availability may go stale" },
];

export function NotificationsSection({ initial }: { initial: Prefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);

  async function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ [key]: next[key] }) });
    router.refresh();
  }

  return (
    <div className="card card--pad">
      <p className="help-a" style={{ marginTop: 0 }}>
        Get a push notification on this device when something needs you — even when the app is closed. Turn on notifications for the device first, then choose which events.
      </p>
      <div style={{ margin: "12px 0 4px" }}><PushToggle /></div>

      {EVENTS.map((e) => (
        <div key={e.key} className="spread" style={{ padding: "12px 0", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ minWidth: 0, paddingRight: 12 }}>
            <div style={{ fontWeight: 600 }}>{e.label}</div>
            <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>{e.hint}</div>
          </div>
          <button type="button" className={`switch${prefs[e.key] ? " on" : ""}`} onClick={() => toggle(e.key)} aria-label={`Toggle ${e.label}`} aria-pressed={prefs[e.key]}><span /></button>
        </div>
      ))}
    </div>
  );
}
