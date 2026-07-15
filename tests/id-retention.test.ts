import { describe, it, expect } from "vitest";
import { isIdExpired, expiredIdDocuments, strictestRetentionDays } from "@/lib/id-retention";

const now = new Date("2026-07-02T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe("isIdExpired", () => {
  it("expires a document older than the retention window", () => {
    expect(isIdExpired(daysAgo(200), 180, now)).toBe(true);
    expect(isIdExpired(daysAgo(100), 180, now)).toBe(false);
  });
  it("never expires with no/zero policy or unknown upload date", () => {
    expect(isIdExpired(daysAgo(9999), null, now)).toBe(false);
    expect(isIdExpired(daysAgo(9999), 0, now)).toBe(false);
    expect(isIdExpired(null, 180, now)).toBe(false);
  });
});

describe("expiredIdDocuments", () => {
  it("selects only guests with a document past the window", () => {
    const guests = [
      { id: "a", idDocumentPath: "a/id.jpg", idUploadedAt: daysAgo(200) }, // expired
      { id: "b", idDocumentPath: "b/id.jpg", idUploadedAt: daysAgo(10) },  // fresh
      { id: "c", idDocumentPath: null, idUploadedAt: daysAgo(200) },        // no doc
      { id: "d", idDocumentPath: "d/id.jpg", idUploadedAt: null },          // undated
    ];
    expect(expiredIdDocuments(guests, 180, now).map((g) => g.id)).toEqual(["a"]);
    expect(expiredIdDocuments(guests, null, now)).toEqual([]);
  });
});

describe("strictestRetentionDays (owner-wide window for shared guests)", () => {
  it("is UNCHANGED for a single property — its own window, exactly like before", () => {
    expect(strictestRetentionDays([180])).toBe(180);
    expect(strictestRetentionDays([null])).toBe(null); // no window set → keep forever
    expect(strictestRetentionDays([0])).toBe(null); // 0 = keep forever
  });

  it("takes the STRICTEST (shortest positive) window across the owner's properties", () => {
    expect(strictestRetentionDays([180, 90])).toBe(90); // Lawei 90 wins over Pine 180
    expect(strictestRetentionDays([90, 180, 365])).toBe(90);
  });

  it("ignores properties with no window, but honours the ones that set one", () => {
    expect(strictestRetentionDays([null, 180])).toBe(180); // one strict, one unset → 180
    expect(strictestRetentionDays([180, 0, null])).toBe(180); // 0 and null impose nothing
  });

  it("keeps indefinitely when NO property sets a window", () => {
    expect(strictestRetentionDays([null, 0, null])).toBe(null);
    expect(strictestRetentionDays([])).toBe(null);
  });
})
