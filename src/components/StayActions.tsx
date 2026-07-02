"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Icon } from "@/components/ui";

type Action = "checkin" | "checkout" | "undo";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// Contextual hero action: the primary thing to do right now (check the guest in,
// then out). Not Edit — that lives in the footer.
export function StayActions({
  reservationId,
  checkedInAt,
  checkedOutAt,
  idBlockReason = null,
  idHardBlock = false,
  guestId,
}: {
  reservationId: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  idBlockReason?: string | null;
  idHardBlock?: boolean;
  guestId?: string;
}) {
  const router = useRouter();
  const { alert } = useConfirm();
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    const res = await fetch(`/api/reservations/${reservationId}/stay`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (res.ok) return router.refresh();
    const j = await res.json().catch(() => ({}));
    await alert({ title: "Couldn’t update", message: j.error ?? "Please try again." });
  }

  const state = checkedOutAt ? "out" : checkedInAt ? "in" : "none";
  // Before check-in, show the ID reason (policy 'warn' or 'block'); only 'block'
  // (idHardBlock) actually disables the button.
  const showIdReason = state === "none" && !!idBlockReason;
  const checkInBlocked = showIdReason && idHardBlock;

  if (state === "out") {
    return (
      <div className="card card--pad" style={{ marginTop: 14 }}>
        <div className="spread">
          <div>
            <div style={{ fontWeight: 600, color: "var(--ink)" }}>Checked out</div>
            <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>Departed {fmt(checkedOutAt!)}</div>
          </div>
          <button onClick={() => run("undo")} disabled={busy} className="btn btn--quiet btn--sm">Undo</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      {/* ID reason before check-in. 'block' disables the button; 'warn' just informs. */}
      {showIdReason && (
        <div className="banner banner--warn" style={{ marginBottom: 10, cursor: "default" }}>
          <span className="banner__icon"><Icon name="alert" size={18} /></span>
          <span className="banner__txt" style={{ flex: 1 }}>
            {idBlockReason}{!idHardBlock && " (you can still check in)"}{" "}
            {guestId && <Link href={`/guests/${guestId}`} style={{ fontWeight: 700, textDecoration: "underline" }}>Record ID</Link>}
          </span>
        </div>
      )}
      {state === "none" ? (
        <button onClick={() => run("checkin")} disabled={busy || checkInBlocked} className="btn btn--primary btn--block">
          <Icon name="arrowDown" size={17} /> Check in guest
        </button>
      ) : (
        <button onClick={() => run("checkout")} disabled={busy} className="btn btn--primary btn--block">
          <Icon name="logout" size={17} /> Check out guest
        </button>
      )}
      <div className="spread" style={{ marginTop: 8 }}>
        <span className="muted" style={{ fontSize: "var(--fs-meta)" }}>
          {state === "in" ? `In-house · arrived ${fmt(checkedInAt!)}` : checkInBlocked ? "Record the guest's ID to enable check-in" : "Tap when the guest arrives"}
        </span>
        {state === "in" && (
          <button onClick={() => run("undo")} disabled={busy} className="btn btn--quiet btn--sm">Undo check-in</button>
        )}
      </div>
    </div>
  );
}
