"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui";
import type { ModuleDef, ModuleId } from "@/lib/modules";

// Per-property module switches, for the vendor console only.
//
// Optimistic: the toggle flips immediately and rolls back if the server refuses.
// A switch that lags a second feels broken, and this is a screen someone will use
// while a client is on the phone.

export function AdminModules({
  propertyId,
  propertyName,
  modules,
  disabled,
}: {
  propertyId: string;
  propertyName: string;
  modules: ModuleDef[];
  disabled: string[];
}) {
  const [off, setOff] = useState<Set<string>>(new Set(disabled));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const groups = [...new Set(modules.map((m) => m.group))];

  function toggle(id: ModuleId) {
    const next = new Set(off);
    if (next.has(id)) next.delete(id);
    else next.add(id);

    const previous = off;
    setOff(next); // optimistic
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/admin/modules", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, disabledModules: [...next] }),
      });
      if (!res.ok) {
        setOff(previous); // roll back — the UI must never claim a change that didn't land
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not save. Nothing was changed.");
      }
    });
  }

  const onCount = modules.length - modules.filter((m) => off.has(m.id)).length;

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel__hd">
        <div className="panel__l">
          <span className="panel__t">{propertyName}</span>
          <span className="panel__c">{onCount}/{modules.length} on</span>
        </div>
        {pending && <span className="kpi-eyebrow">Saving…</span>}
      </div>

      <div className="panel__bd">
        {error && (
          <div className="banner banner--danger" style={{ marginBottom: 12 }}>
            <span className="banner__txt">{error}</span>
          </div>
        )}

        {groups.map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div className="kpi-eyebrow" style={{ marginBottom: 8 }}>{g}</div>
            <div className="modgrid">
              {modules
                .filter((m) => m.group === g)
                .map((m) => {
                  const on = !off.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.id)}
                      className={`modrow${on ? " modrow--on" : ""}`}
                      aria-pressed={on}
                    >
                      <span className="modrow__box">{on && <Icon name="check" size={13} />}</span>
                      <span className="modrow__m">
                        <span className="modrow__t">{m.label}</span>
                        <span className="modrow__s">{m.blurb}</span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}

        <p style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)", margin: 0 }}>
          Today, Calendar, Bookings, Guests, Housekeeping, Needs you, Finance, Pricing, Analytics and Settings are the
          product — they can&rsquo;t be switched off.
        </p>
      </div>
    </section>
  );
}
