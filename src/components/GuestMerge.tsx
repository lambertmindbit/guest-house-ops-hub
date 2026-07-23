"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Icon } from "@/components/ui";

// Surfaces likely duplicates of the guest being viewed (same phone, typed
// differently) and folds them in on one tap (GAP-19). Only rendered when candidates
// exist, so it stays out of the way otherwise.
export function GuestMerge({
  survivorId,
  candidates,
}: {
  survivorId: string;
  candidates: { id: string; name: string; phone: string; bookings: number }[];
}) {
  const router = useRouter();
  const { confirm, alert } = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  async function merge(dup: { id: string; name: string; bookings: number }) {
    const okToGo = await confirm({
      title: "Merge this duplicate?",
      message: `“${dup.name}” and its ${dup.bookings} booking${dup.bookings === 1 ? "" : "s"} will be moved onto this guest, and the duplicate record deleted. This can't be undone.`,
      confirmLabel: "Merge",
      danger: true,
    });
    if (!okToGo) return;
    setBusy(dup.id);
    const res = await fetch(`/api/guests/${survivorId}/merge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ duplicateId: dup.id }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return void alert({ title: "Couldn’t merge", message: j.error ?? "Please try again." });
    }
    router.refresh();
  }

  if (candidates.length === 0) return null;

  return (
    <div className="banner banner--warn" style={{ cursor: "default", marginTop: 16, alignItems: "flex-start" }}>
      <span className="banner__icon"><Icon name="alert" size={18} /></span>
      <span style={{ flex: 1 }}>
        <b>Possible duplicate{candidates.length === 1 ? "" : "s"}</b> — same phone number as this guest.
        <div className="col" style={{ gap: 8, marginTop: 10 }}>
          {candidates.map((c) => (
            <div key={c.id} className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-small)" }}>
                <b>{c.name}</b> · {c.phone} · {c.bookings} booking{c.bookings === 1 ? "" : "s"}
              </span>
              <button className="btn btn--primary btn--sm" disabled={busy === c.id} onClick={() => merge(c)}>
                {busy === c.id ? "Merging…" : "Merge in"}
              </button>
            </div>
          ))}
        </div>
      </span>
    </div>
  );
}
