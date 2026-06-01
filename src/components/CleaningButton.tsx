"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <button
      onClick={update}
      disabled={busy}
      className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
    >
      {busy ? "…" : "Mark clean"}
    </button>
  ) : (
    <button
      onClick={update}
      disabled={busy}
      className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
    >
      {busy ? "…" : "Needs cleaning"}
    </button>
  );
}
