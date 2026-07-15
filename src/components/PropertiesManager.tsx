"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

type Property = { id: string; name: string };

// Manage the owner's properties: see them all, add one, switch between them.
// The switcher in the nav only appears once there are 2+, so this is where the
// second one is born.
export function PropertiesManager({
  properties,
  currentId,
}: {
  properties: Property[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Could not add the property.");
        return;
      }
      setName("");
      setJustAdded(body.data.name);
      router.refresh(); // pull the new property into the list + switcher
    });
  }

  function switchTo(id: string) {
    if (id === currentId) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/session/property", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId: id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not switch property.");
        return;
      }
      router.refresh(); // the whole app re-scopes to the switched property
    });
  }

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__hd">
          <div className="panel__l">
            <span className="panel__t">Your properties</span>
            <span className="panel__c">{properties.length}</span>
          </div>
        </div>
        <div className="panel__rows">
          {properties.map((p) => {
            const active = p.id === currentId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => switchTo(p.id)}
                className="rowcard"
                style={{ width: "100%", textAlign: "left", cursor: active ? "default" : "pointer" }}
                disabled={pending}
              >
                <div className="rowcard__main">
                  <div className="rowcard__name">{p.name}</div>
                  <div className="rowcard__meta">{active ? "Currently viewing" : "Tap to switch"}</div>
                </div>
                {active ? (
                  <span className="badge badge--good">Current</span>
                ) : (
                  <Icon name="arrowR" size={16} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel__hd">
          <div className="panel__l"><span className="panel__t">Add a property</span></div>
        </div>
        <div className="panel__bd">
          {justAdded && (
            <div className="banner banner--good" style={{ marginBottom: 12 }}>
              <span className="banner__txt">
                Added <b>{justAdded}</b>. It comes with the usual channels — now add its rooms in{" "}
                <a href="/settings/rooms">Rooms</a> and switch to it above.
              </span>
            </div>
          )}
          {error && (
            <div className="banner banner--danger" style={{ marginBottom: 12 }}>
              <span className="banner__txt">{error}</span>
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="new-property-name">Property name</label>
            <input
              id="new-property-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="e.g. Pine Air B&B — Riverside"
              maxLength={120}
              disabled={pending}
            />
          </div>
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 12 }}
            onClick={add}
            disabled={pending || !name.trim()}
          >
            <Icon name="plus" size={16} /> {pending ? "Adding…" : "Add property"}
          </button>
          <p style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)", margin: "12px 0 0" }}>
            Each property keeps its own rooms, bookings, pricing and finances. Guests are shared across all your
            properties.
          </p>
        </div>
      </div>
    </>
  );
}
