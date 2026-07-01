import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/import";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("handles quoted commas and escaped quotes", () => {
    expect(parseCsv('name,note\n"Doe, John","said ""hi"""')).toEqual([
      ["name", "note"],
      ["Doe, John", 'said "hi"'],
    ]);
  });

  it("handles CRLF and drops blank lines / trailing newline", () => {
    expect(parseCsv("a\r\n1\r\n\r\n")).toEqual([["a"], ["1"]]);
  });

  it("keeps newlines embedded inside quoted fields", () => {
    expect(parseCsv('a\n"line1\nline2"')).toEqual([["a"], ["line1\nline2"]]);
  });
});
