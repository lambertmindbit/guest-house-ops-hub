import { describe, it, expect } from "vitest";
import { isIdExpired, expiredIdDocuments } from "@/lib/id-retention";

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
