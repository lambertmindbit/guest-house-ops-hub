import { describe, it, expect } from "vitest";
import { bookingConfirmation } from "@/lib/message-templates";

describe("bookingConfirmation", () => {
  const base = {
    guestName: "Ibaphinri",
    propertyName: "Lawei Homestay",
    roomLabel: "102",
    checkIn: "Mon, 1 Jun 2026",
    checkOut: "Wed, 3 Jun 2026",
    nights: 2,
  };

  it("interpolates every field with no leftover placeholders", () => {
    const { body } = bookingConfirmation(base);
    expect(body).toContain("Ibaphinri");
    expect(body).toContain("Lawei Homestay");
    expect(body).toContain("Room 102");
    expect(body).toContain("Mon, 1 Jun 2026 to Wed, 3 Jun 2026");
    expect(body).toContain("2 nights");
    expect(body).not.toMatch(/undefined|null|\{\{/);
  });

  it("uses the singular night for a one-night stay", () => {
    expect(bookingConfirmation({ ...base, nights: 1 }).body).toContain("1 night");
    expect(bookingConfirmation({ ...base, nights: 1 }).body).not.toContain("1 nights");
  });
});
