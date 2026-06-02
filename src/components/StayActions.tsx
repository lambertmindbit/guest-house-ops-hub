"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

type Action = "checkin" | "checkout" | "undo";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function StayActions({
  reservationId,
  checkedInAt,
  checkedOutAt,
}: {
  reservationId: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    const res = await fetch(`/api/reservations/${reservationId}/stay`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Could not update — please try again.");
  }

  const state = checkedOutAt ? "out" : checkedInAt ? "in" : "none";

  return (
    <div className="card" style={{ padding: 16, marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>
            {state === "out" ? "Checked out" : state === "in" ? "In-house" : "Not arrived yet"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--subtle)", marginTop: 3 }}>
            {state === "out" && `Departed ${fmt(checkedOutAt!)}`}
            {state === "in" && `Arrived ${fmt(checkedInAt!)}`}
            {state === "none" && "Tap check-in when the guest arrives"}
          </div>
        </div>
        <div className="row" style={{ gap: 6, flex: "none" }}>
          {state === "none" && (
            <button onClick={() => run("checkin")} disabled={busy} className="btn btn--good btn--sm">
              <Icon name="arrowR" size={16} /> Check in
            </button>
          )}
          {state === "in" && (
            <>
              <button onClick={() => run("undo")} disabled={busy} className="btn btn--ghost btn--sm">Undo</button>
              <button onClick={() => run("checkout")} disabled={busy} className="btn btn--primary btn--sm">
                <Icon name="logout" size={16} /> Check out
              </button>
            </>
          )}
          {state === "out" && (
            <button onClick={() => run("undo")} disabled={busy} className="btn btn--ghost btn--sm">Undo checkout</button>
          )}
        </div>
      </div>
    </div>
  );
}
