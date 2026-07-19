"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

// Marks a cleaned room inspected (GAP-20). Only rendered when the property has the
// optional inspection step turned on.
export function InspectButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function inspect() {
    setBusy(true);
    await fetch(`/api/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markInspected: true }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button onClick={inspect} disabled={busy} className="btn btn--success" style={{ flex: "none" }}>
      <Icon name="check" size={17} /> {busy ? "…" : "Mark inspected"}
    </button>
  );
}
