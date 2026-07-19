"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Icon } from "@/components/ui";

// Issuing consumes a number in the financial-year series and freezes the figures,
// so it's an explicit action — and re-issuing is confirmed, since it cancels the
// original invoice and creates a new one.
export function IssueInvoiceButton({ reservationId, reissue = false }: { reservationId: string; reissue?: boolean }) {
  const router = useRouter();
  const { confirm, alert } = useConfirm();
  const [busy, setBusy] = useState(false);

  async function go() {
    if (reissue) {
      const okToGo = await confirm({
        title: "Re-issue this invoice?",
        message:
          "The current invoice will be marked CANCELLED and a new number issued. Both are kept, so the series stays unbroken. Do this only if the booking details changed.",
        confirmLabel: "Re-issue",
        danger: true,
      });
      if (!okToGo) return;
    }
    setBusy(true);
    const res = await fetch(`/api/reservations/${reservationId}/invoice`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reissue }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return void alert({ title: "Couldn’t issue the invoice", message: j.error ?? "Please try again." });
    }
    router.refresh();
  }

  return (
    <button onClick={go} disabled={busy} className={`btn btn--sm ${reissue ? "btn--ghost" : "btn--primary"}`}>
      <Icon name="receipt" size={15} /> {busy ? "Working…" : reissue ? "Re-issue" : "Issue invoice"}
    </button>
  );
}
