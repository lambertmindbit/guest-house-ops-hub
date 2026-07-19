import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseBookingEmail } from "@/lib/email-parse";

// Fixture corpus gate (GAP-2 / US-302 spirit): parser changes must keep
// classifying and extracting these correctly. Synthetic for now — real OTA
// samples replace these when collected, and this test runs them in CI.
const load = (f: string) => parseBookingEmail(readFileSync(new URL(`./fixtures/ota-emails/${f}`, import.meta.url), "utf8"));

const CASES: { file: string; source: string; kind: string; otaRef: string }[] = [
  { file: "booking-com-new.txt", source: "Booking.com", kind: "new", otaRef: "4820033117" },
  { file: "booking-com-modification.txt", source: "Booking.com", kind: "modification", otaRef: "4820033117" },
  { file: "booking-com-cancellation.txt", source: "Booking.com", kind: "cancellation", otaRef: "4820033117" },
  { file: "agoda-new.txt", source: "Agoda", kind: "new", otaRef: "AGD778899" },
  { file: "agoda-cancellation.txt", source: "Agoda", kind: "cancellation", otaRef: "AGD778899" },
  { file: "makemytrip-modification.txt", source: "MakeMyTrip", kind: "modification", otaRef: "NH7009823451" },
];

describe("OTA email corpus", () => {
  for (const c of CASES) {
    it(`${c.file} → ${c.source} / ${c.kind} / ${c.otaRef}`, () => {
      const p = load(c.file);
      expect(p.source).toBe(c.source);
      expect(p.kind).toBe(c.kind);
      expect(p.otaRef).toBe(c.otaRef);
    });
  }

  it("extracts the NEW dates and amount from a modification", () => {
    const p = load("booking-com-modification.txt");
    expect(p.checkIn).toBe("2026-07-15");
    expect(p.checkOut).toBe("2026-07-18");
    expect(p.amount).toBe(10500);
  });
});
