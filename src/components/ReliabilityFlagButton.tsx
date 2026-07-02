"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

// Owner action on a repeat-no-show guest: file a shared repeat-offender alert.
// Stats are recomputed server-side; the alert enters the normal bad-guest
// workflow (verify to share, appealable).
export function ReliabilityFlagButton({ guestId }: { guestId: string }) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flag() {
    if (!(await confirm({ title: "Flag repeat no-show", message: "File a shared repeat-no-show alert for this guest? It stays private until you verify it in Settings › Bad-guest alerts.", confirmLabel: "File alert" }))) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/guests/${guestId}/reliability-flag`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not file the alert.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) return <span style={{ fontSize: "var(--fs-small)", color: "var(--green-text)" }}>Alert filed ✓ — verify to share</span>;

  return (
    <span className="row" style={{ gap: 8, alignItems: "center" }}>
      <button className="btn btn--ghost btn--sm" onClick={flag} disabled={busy}>{busy ? "Filing…" : "Flag repeat no-show"}</button>
      {error && <span style={{ fontSize: "var(--fs-meta)", color: "var(--red-text)" }}>{error}</span>}
    </span>
  );
}
