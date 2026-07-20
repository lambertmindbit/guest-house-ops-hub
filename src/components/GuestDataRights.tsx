"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import { Icon } from "@/components/ui";

// DPDP data-principal rights (GAP-8/US-202). Export is read-only; erasure is
// irreversible, so it's double-confirmed and states plainly what survives.
export function GuestDataRights({ guestId, erasedAt }: { guestId: string; erasedAt: string | null }) {
  const router = useRouter();
  const { confirm, alert } = useConfirm();
  const [busy, setBusy] = useState(false);

  async function erase() {
    const okToGo = await confirm({
      title: "Erase this guest's personal data?",
      message:
        "This cannot be undone. Name, phone, email, ID details, addresses, free-text notes and message history are permanently anonymised.\n\nKept by law: issued tax invoices (statutory GST retention) and the booking's dates and amounts, so your accounts stay correct. If the guest is blacklisted, the block survives as a one-way hash.",
      confirmLabel: "Erase permanently",
      danger: true,
    });
    if (!okToGo) return;

    setBusy(true);
    const res = await fetch(`/api/guests/${guestId}/erase`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return void alert({ title: "Couldn’t erase", message: j.error ?? "Please try again." });
    }
    router.refresh();
  }

  if (erasedAt) {
    return (
      <div className="banner" style={{ cursor: "default", marginTop: 16 }}>
        <span className="banner__icon"><Icon name="check" size={18} /></span>
        <span style={{ flex: 1 }}>
          Personal data was erased on {new Date(erasedAt).toISOString().slice(0, 10)} at the guest&apos;s request.
          Invoices and booking amounts were retained as legally required.
        </span>
      </div>
    );
  }

  return (
    <div className="card card--pad" style={{ marginTop: 16 }}>
      <div className="h3">Guest data rights</div>
      <div className="muted" style={{ fontSize: "var(--fs-small)", marginTop: 4 }}>
        Handle a guest&apos;s request to see or erase the personal data you hold about them. Both actions are recorded in the audit log.
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <a href={`/api/guests/${guestId}/export`} className="btn btn--ghost btn--sm">
          <Icon name="receipt" size={15} /> Export their data
        </a>
        <button onClick={erase} disabled={busy} className="btn btn--ghost btn--sm" style={{ color: "var(--danger-text, #b91c1c)" }}>
          <Icon name="alert" size={15} /> {busy ? "Erasing…" : "Erase personal data"}
        </button>
      </div>
    </div>
  );
}
