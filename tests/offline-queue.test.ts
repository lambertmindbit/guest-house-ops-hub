import { describe, it, expect } from "vitest";
import { isQueueableRequest, replayOrder, classifyReplay, shouldKeepQueued, type QueuedRequest } from "@/lib/offline-queue";

describe("isQueueableRequest", () => {
  it("queues state-changing API writes", () => {
    expect(isQueueableRequest("POST", "/api/reservations")).toBe(true);
    expect(isQueueableRequest("patch", "/api/reservations/abc")).toBe(true);
    expect(isQueueableRequest("DELETE", "/api/blocks/1")).toBe(true);
  });
  it("skips reads and non-API / excluded paths", () => {
    expect(isQueueableRequest("GET", "/api/reservations")).toBe(false);
    expect(isQueueableRequest("POST", "/login")).toBe(false);
    expect(isQueueableRequest("POST", "/api/auth/login")).toBe(false);
    expect(isQueueableRequest("POST", "/api/agent/reservations")).toBe(false);
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
