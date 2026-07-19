import { describe, it, expect } from "vitest";
import { redactCardNumbers } from "@/lib/redact";

describe("redactCardNumbers (US-306)", () => {
  it("redacts a 16-digit card — continuous, spaced, or dashed", () => {
    expect(redactCardNumbers("Card: 4111111111111111 end")).toBe("Card: [redacted card] end");
    expect(redactCardNumbers("Card: 4111 1111 1111 1111")).not.toContain("4111");
    expect(redactCardNumbers("Card: 4111-1111-1111-1111")).not.toContain("1111");
  });

  it("redacts a 15-digit Amex and a 13-digit card", () => {
    expect(redactCardNumbers("Amex 3782 822463 10005")).not.toContain("3782");
    expect(redactCardNumbers("4222222222222")).toBe("[redacted card]");
  });

  it("redacts a virtual-card number (still a 16-digit PAN)", () => {
    expect(redactCardNumbers("Virtual card 5200828282828210")).not.toMatch(/\d{13,}/);
  });

  it("leaves booking refs, phones, amounts and dates intact (below the 13-digit floor)", () => {
    expect(redactCardNumbers("Booking number: 1234567890")).toBe("Booking number: 1234567890");
    expect(redactCardNumbers("Phone: +91 98100 12345")).toBe("Phone: +91 98100 12345");
    expect(redactCardNumbers("Total: ₹ 7,000 on 2026-07-12")).toBe("Total: ₹ 7,000 on 2026-07-12");
  });
});
