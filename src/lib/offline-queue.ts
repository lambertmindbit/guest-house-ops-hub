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

// Which requests we queue when offline: state-changing API calls only. Auth is
// excluded (a login must happen online), as are the token-gated seams.
export function isQueueableRequest(method: string, url: string): boolean {
  const m = method.toUpperCase();
  if (m !== "POST" && m !== "PATCH" && m !== "PUT" && m !== "DELETE") return false;
  let path: string;
  try {
    path = new URL(url, "http://x").pathname;
  } catch {
    return false;
  }
  if (!path.startsWith("/api/")) return false;
  return !["/api/auth", "/api/agent", "/api/ingest", "/api/cron"].some((p) => path.startsWith(p));
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
