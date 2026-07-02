"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GroupCreate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/booking-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Could not create group."); return; }
    setName("");
    router.refresh();
  }

  return (
    <div className="card card--pad" style={{ marginBottom: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" placeholder="Group name (e.g. Sharma family / Trek group)" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={add} disabled={busy || !name.trim()}>New group</button>
      </div>
      {error && <p style={{ color: "var(--red-text)", fontSize: "var(--fs-small)", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
