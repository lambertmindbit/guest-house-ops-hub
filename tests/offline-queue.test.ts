import { describe, it, expect } from "vitest";
import { isQueueableRequest, replayOrder, classifyReplay, shouldKeepQueued, type QueuedRequest } from "@/lib/offline-queue";

describe("isQueueableRequest (US-901 — strict allowlist)", () => {
  it("queues ONLY check-in/out stamps and housekeeping marks", () => {
    expect(isQueueableRequest("PATCH", "/api/reservations/abc/stay")).toBe(true); // check-in/out/undo
    expect(isQueueableRequest("patch", "/api/reservations/abc/stay?x=1")).toBe(true); // case + query
    expect(isQueueableRequest("POST", "/api/housekeeping/tasks")).toBe(true); // mark clean
  });

  it("does NOT queue writes that could silently fail or move money", () => {
    // A booking can 409 on replay — never tell the owner it's "saved" offline.
    expect(isQueueableRequest("POST", "/api/reservations")).toBe(false);
    expect(isQueueableRequest("PATCH", "/api/reservations/abc")).toBe(false); // edit a booking
    // Money writes must never be queued.
    expect(isQueueableRequest("POST", "/api/reservations/abc/payments")).toBe(false);
    expect(isQueueableRequest("POST", "/api/reservations/abc/refunds")).toBe(false);
    // Other state changes are not in scope.
    expect(isQueueableRequest("DELETE", "/api/blocks/1")).toBe(false);
    expect(isQueueableRequest("PATCH", "/api/rooms/1")).toBe(false); // dual-purpose (edits + inspect)
  });

  it("skips reads, non-API, and the wrong method on an allowlisted path", () => {
    expect(isQueueableRequest("GET", "/api/reservations/abc/stay")).toBe(false); // reads never queue
    expect(isQueueableRequest("POST", "/api/reservations/abc/stay")).toBe(false); // stay is PATCH-only
    expect(isQueueableRequest("PATCH", "/api/housekeeping/tasks")).toBe(false); // tasks is POST-only
    expect(isQueueableRequest("POST", "/login")).toBe(false);
    expect(isQueueableRequest("POST", "/api/auth/login")).toBe(false);
  });
});

describe("replayOrder", () => {
  it("returns FIFO (oldest first) without mutating the input", () => {
    const q: QueuedRequest[] = [
      { id: "b", url: "/api/x", method: "POST", headers: {}, body: null, enqueuedAt: 200 },
      { id: "a", url: "/api/x", method: "POST", headers: {}, body: null, enqueuedAt: 100 },
      { id: "c", url: "/api/x", method: "POST", headers: {}, body: null, enqueuedAt: 300 },
    ];
    expect(replayOrder(q).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(q[0].id).toBe("b"); // original untouched
  });
});

describe("classifyReplay / shouldKeepQueued", () => {
  it("maps status to an outcome and keeps only retryable ones", () => {
    expect(classifyReplay(201)).toBe("applied");
    expect(classifyReplay(409)).toBe("conflict"); // lost the race → surfaced
    expect(classifyReplay(422)).toBe("failed");
    expect(classifyReplay(500)).toBe("retry");
    expect(classifyReplay(0)).toBe("retry"); // still offline

    expect(shouldKeepQueued("applied")).toBe(false);
    expect(shouldKeepQueued("conflict")).toBe(false);
    expect(shouldKeepQueued("failed")).toBe(false);
    expect(shouldKeepQueued("retry")).toBe(true);
  });
});
