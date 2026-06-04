"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

// Destructive Cancel lives behind a ⋯ overflow so it's never a peer of Edit.
// Cancelling flips status to 'cancelled', freeing the dates (the exclusion
// constraint only applies to confirmed stays).
export function ReservationOverflow({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!confirm("Cancel this reservation? The dates will be freed.")) return;
    setBusy(true);
    const res = await fetch(`/api/reservations/${id}/cancel`, { method: "POST" });
    setBusy(false);
    setOpen(false);
    if (res.ok) router.refresh();
    else alert("Could not cancel — please try again.");
  }

  return (
    <div style={{ position: "relative", flex: "none" }}>
      <button className="btn btn--ghost btn--icon" onClick={() => setOpen((o) => !o)} aria-label="More actions" aria-haspopup="menu" aria-expanded={open}>
        <Icon name="more" size={18} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            role="menu"
            style={{
              position: "absolute", right: 0, bottom: "calc(100% + 6px)", zIndex: 41, minWidth: 210,
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-lg)", overflow: "hidden",
            }}
          >
            <button role="menuitem" className="sheet__row" onClick={cancel} disabled={busy} style={{ color: "var(--red-text)" }}>
              <Icon name="x" size={16} /> {busy ? "Cancelling…" : "Cancel reservation"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
