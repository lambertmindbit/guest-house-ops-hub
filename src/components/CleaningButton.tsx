"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

export function CleaningButton({ roomId, markCleaned }: { roomId: string; markCleaned: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update() {
    setBusy(true);
    await fetch(`/api/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markCleaned }),
    });
    setBusy(false);
    router.refresh();
  }

  return markCleaned ? (
    <button onClick={update} disabled={busy} className="btn btn--success" style={{ flex: "none" }}>
      <Icon name="check" size={17} /> {busy ? "…" : "Mark clean"}
    </button>
  ) : (
    <button onClick={update} disabled={busy} className="btn btn--ghost btn--sm" style={{ flex: "none" }}>
      {busy ? "…" : "Needs cleaning"}
    </button>
  );
}
