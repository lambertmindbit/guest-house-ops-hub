import { describe, it, expect } from "vitest";
import { parseBookingEmail, parseLooseDate } from "@/lib/email-parse";

// Synthetic fixtures — they prove the parsing pipeline works end to end.
// Real OTA emails will need the regexes tuned; the review screen makes that safe.

describe("parseLooseDate", () => {
  it("handles ISO, D-Month-Y, and Month-D-Y", () => {
    expect(parseLooseDate("2026-07-12")).toBe("2026-07-12");
    expect(parseLooseDate("Friday, 12 July 2026")).toBe("2026-07-12");
    expect(parseLooseDate("Jul 12 2026")).toBe("2026-07-12");
    expect(parseLooseDate("July 9, 2026")).toBe("2026-07-09");
    expect(parseLooseDate("no date here")).toBeNull();
  });
});

describe("parseBookingEmail", () => {
  it("detects the channel", () => {
    expect(parseBookingEmail("Your Booking.com reservation").source).toBe("Booking.com");
    expect(parseBookingEmail("Thanks for booking with Agoda").source).toBe("Agoda");
    expect(parseBookingEmail("MakeMyTrip booking confirmed").source).toBe("MakeMyTrip");
    expect(parseBookingEmail("plain text").source).toBe("Unknown");
  });

  it("extracts fields from a Booking.com-style email", () => {
    const raw = [
      "Your booking is confirmed — Booking.com",
      "Booking number: 1234567890",
      "Guest name: Priya Nair",
      "Phone: +91 98100 12345",
      "Room: Deluxe Double",
      "Check-in: Friday, 12 July 2026",
      "Check-out: Sunday, 14 July 2026",
      "Total price: ₹ 7,000",
    ].join("\n");
    const p = parseBookingEmail(raw);
    expect(p.source).toBe("Booking.com");
    expect(p.otaRef).toBe("1234567890");
    expect(p.guestName).toBe("Priya Nair");
    expect(p.guestPhone).toContain("98100");
    expect(p.roomTypeHint).toContain("Deluxe");
    expect(p.checkIn).toBe("2026-07-12");
    expect(p.checkOut).toBe("2026-07-14");
    expect(p.amount).toBe(7000);
  });

  it("returns nulls for missing fields rather than throwing", () => {
    const p = parseBookingEmail("Agoda — something went here with no details");
    expect(p.source).toBe("Agoda");
    expect(p.otaRef).toBeNull();
    expect(p.checkIn).toBeNull();
    expect(p.amount).toBeNull();
  });
});
