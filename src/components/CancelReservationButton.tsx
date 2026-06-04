"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

// Cancelling flips status to 'cancelled', which frees the dates (the exclusion
// constraint only applies to confirmed stays).
export function CancelReservationButton({ id }: { id: string }) {
  const router = useRouter();
  const { confirm, alert } = useConfirm();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!(await confirm({ title: "Cancel reservation", message: "The dates will be freed.", danger: true, confirmLabel: "Cancel reservation", cancelLabel: "Keep" }))) return;
    setBusy(true);
    const res = await fetch(`/api/reservations/${id}/cancel`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.push(`/reservations/${id}`);
      router.refresh();
    } else {
      await alert({ title: "Couldn’t cancel", message: "Please try again." });
    }
  }

  return (
    <button onClick={cancel} disabled={busy} className="btn btn--danger btn--block">
      {busy ? "Cancelling…" : "Cancel reservation"}
    </button>
  );
}
