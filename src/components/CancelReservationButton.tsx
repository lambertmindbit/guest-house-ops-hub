"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Cancelling flips status to 'cancelled', which frees the dates (the exclusion
// constraint only applies to confirmed stays).
export function CancelReservationButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!confirm("Cancel this reservation? The dates will be freed.")) return;
    setBusy(true);
    const res = await fetch(`/api/reservations/${id}/cancel`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.push(`/reservations/${id}`);
      router.refresh();
    } else {
      alert("Could not cancel — please try again.");
    }
  }

  return (
    <button
      onClick={cancel}
      disabled={busy}
      className="w-full rounded-lg border border-red-300 px-4 py-2.5 font-medium text-red-700 disabled:opacity-50"
    >
      {busy ? "Cancelling…" : "Cancel reservation"}
    </button>
  );
}
