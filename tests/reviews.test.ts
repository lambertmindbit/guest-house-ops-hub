import { describe, it, expect } from "vitest";
import { reviewSummary } from "@/lib/reviews";

describe("reviewSummary", () => {
  it("computes received/responded, average rating and response rate", () => {
    const s = reviewSummary([
      { status: "responded", rating: 5 },
      { status: "received", rating: 4 },
      { status: "received", rating: null },
      { status: "sent", rating: null },
      { status: "pending", rating: null },
    ]);
    expect(s.total).toBe(5);
    expect(s.received).toBe(3); // received + responded
    expect(s.responded).toBe(1);
    expect(s.avgRating).toBe(4.5); // (5 + 4) / 2
    expect(s.responseRate).toBe(33); // 1 responded of 3 received
  });

  it("reports 0% response rate and null average when nothing is in yet", () => {
    const s = reviewSummary([{ status: "pending", rating: null }]);
    expect(s.responseRate).toBe(0);
    expect(s.avgRating).toBeNull();
  });
});
