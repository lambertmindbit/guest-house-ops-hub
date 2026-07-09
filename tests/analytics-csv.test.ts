import { describe, expect, it } from "vitest";
import { analyticsCsv } from "@/lib/analytics-csv";
import type { Analytics } from "@/lib/analytics";

const sample: Analytics = {
  from: "2026-07-01",
  to: "2026-07-03",
  nights: 2,
  rooms: 5,
  availableRoomNights: 10,
  soldRoomNights: 4,
  occupancyPct: 40,
  adr: 1850.4,
  revpar: 740.16,
  avgLengthOfStay: 2.5,
  cancellationPct: 11.11,
  bookingsArriving: 3,
  sourceMix: [{ channel: "Booking.com", bookings: 2, roomNights: 3, sharePct: 75 }],
  trend: [
    { date: "2026-07-01", occupancyPct: 40 },
    { date: "2026-07-02", occupancyPct: 40 },
  ],
  byRoomType: [{ name: "Deluxe", soldRoomNights: 4, availableRoomNights: 10, occupancyPct: 40 }],
};

describe("analyticsCsv", () => {
  const csv = analyticsCsv(sample);

  it("emits labelled sections with the metrics", () => {
    expect(csv).toContain("Metric,Value");
    expect(csv).toContain("Occupancy %,40");
    expect(csv).toContain("ADR,1850"); // rounded, no currency symbol
    expect(csv).toContain("Cancellation %,11.1"); // rounded to 1dp
  });

  it("includes each breakdown table", () => {
    expect(csv).toContain("Channel,Bookings,Room-nights,Share %");
    expect(csv).toContain("Room type,Sold room-nights,Available room-nights,Occupancy %");
    expect(csv).toContain("Date,Occupancy %");
    expect(csv).toContain("2026-07-01,40");
  });

  it("quotes a channel name containing a comma", () => {
    const withComma = analyticsCsv({
      ...sample,
      sourceMix: [{ channel: "Agoda, Inc", bookings: 1, roomNights: 1, sharePct: 100 }],
    });
    expect(withComma).toContain('"Agoda, Inc",1,1,100');
  });
});
