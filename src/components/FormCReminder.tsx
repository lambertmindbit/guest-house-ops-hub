"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui";

// Form C reminder for a checked-in foreign guest (GAP-7). Persists from check-in
// until the owner ticks "submitted"; turns red once past the 24h FRRO window.
export function FormCReminder({
  reservationId,
  guestId,
  hoursSinceCheckIn,
  overdue,
  submitted,
}: {
  reservationId: string;
  guestId: string;
  hoursSinceCheckIn: number | null;
  overdue: boolean;
  submitted: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setSubmitted(v: boolean) {
    setBusy(true);
    await fetch(`/api/reservations/${reservationId}/form-c`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ submitted: v }),
    });
    setBusy(false);
    router.refresh();
  }

  if (submitted) {
    return (
      <div className="banner banner--good" style={{ cursor: "default", marginBottom: 14 }}>
        <span className="banner__icon"><Icon name="check" size={18} /></span>
        <span style={{ flex: 1 }}>Form C filed for this foreign guest.</span>
        <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setSubmitted(false)}>Undo</button>
      </div>
    );
  }

  const hrs = hoursSinceCheckIn != null ? Math.floor(hoursSinceCheckIn) : null;
  return (
    <div className={`banner ${overdue ? "banner--danger" : "banner--warn"}`} style={{ cursor: "default", alignItems: "flex-start", marginBottom: 14 }}>
      <span className="banner__icon"><Icon name="alert" size={18} /></span>
      <span style={{ flex: 1 }}>
        <b>Form C {overdue ? "overdue" : "due"}</b> — a foreign guest must be reported to the FRRO within 24h of arrival{hrs != null ? ` (checked in ${hrs}h ago)` : ""}.
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <Link href={`/guests/${guestId}/registration`} className="btn btn--ghost btn--sm">Open Form C</Link>
          <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => setSubmitted(true)}>Mark submitted</button>
        </div>
      </span>
    </div>
  );
}
