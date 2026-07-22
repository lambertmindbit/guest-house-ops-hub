// Offline write queue — the PURE, unit-tested core (Gap 19). The service worker
// (public/sw.js) mirrors these rules; keeping them here as a tested spec means
// the SW's behaviour is pinned even though the SW itself can't be bundled/tested.
//
// The server stays authoritative: a queued write is only ever REPLAYED through
// the live network, so it still hits the no_overlapping_confirmed_stays 409 guard
// and every other server-side check. Nothing is applied locally.

export type QueuedRequest = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  enqueuedAt: number;
};

export type ReplayOutcome = "applied" | "conflict" | "failed" | "retry";

// The ONLY writes queued offline (US-901): check-in/out stamps and housekeeping
// marks. This is a strict ALLOWLIST, not "everything except a few paths", for one
// reason — a queued write returns a fake "saved" (202) to the owner and is replayed
// later. That's acceptable for an idempotent status flip whose worst-case replay is
// benign, but NOT for:
//   • a new booking — it can 409 on replay (dates taken), so the owner would be told
//     "saved" for a booking that never happened;
//   • a payment or refund — money must never be silently queued and replayed.
// Anything off this list fails normally while offline, so the owner is never misled
// about whether a write actually landed. Widen this only for genuinely idempotent,
// low-consequence marks.
const QUEUEABLE: { method: string; match: (path: string) => boolean }[] = [
  // Arrival/departure stamps (StayActions). Idempotent: re-stamping is harmless.
  { method: "PATCH", match: (p) => /^\/api\/reservations\/[^/]+\/stay$/.test(p) },
  // Housekeeping task / room-clean mark (HousekeepingTaskCard). An upsert.
  { method: "POST", match: (p) => p === "/api/housekeeping/tasks" },
];

export function isQueueableRequest(method: string, url: string): boolean {
  const m = method.toUpperCase();
  let path: string;
  try {
    path = new URL(url, "http://x").pathname;
  } catch {
    return false;
  }
  return QUEUEABLE.some((q) => q.method === m && q.match(path));
}

// FIFO: replay oldest first so dependent writes keep their order.
export function replayOrder(queue: QueuedRequest[]): QueuedRequest[] {
  return [...queue].sort((a, b) => a.enqueuedAt - b.enqueuedAt);
}

// Classify a replay result by HTTP status:
//   2xx      → applied  (done — remove from queue)
//   409      → conflict (the write lost a race, e.g. those dates are no longer
//                        available — remove + surface to the user)
//   other 4xx→ failed   (permanently rejected — remove + surface)
//   0 / 5xx  → retry    (network still down or a transient server error — keep)
export function classifyReplay(status: number): ReplayOutcome {
  if (status >= 200 && status < 300) return "applied";
  if (status === 409) return "conflict";
  if (status >= 400 && status < 500) return "failed";
  return "retry";
}

// A replayed request stays queued only when the outcome is retryable.
export function shouldKeepQueued(outcome: ReplayOutcome): boolean {
  return outcome === "retry";
}
