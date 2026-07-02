import { describe, it, expect } from "vitest";
import { bookingConfirmation, preArrivalDirections, paymentRequest, paymentReminder } from "@/lib/message-templates";

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

describe("preArrivalDirections", () => {
  const base = { guestName: "Riya", propertyName: "Lawei Homestay", checkIn: "Mon, 1 Jun 2026", checkInTime: "14:00" };
  it("includes the address when provided, and omits it cleanly when not", () => {
    expect(preArrivalDirections({ ...base, address: "Mawlai, Shillong" }).body).toContain("Mawlai, Shillong");
    const noAddr = preArrivalDirections(base).body;
    expect(noAddr).toContain("Riya");
    expect(noAddr).toContain("from 14:00");
    expect(noAddr).not.toMatch(/undefined|null|\{\{/);
  });
});

describe("payment templates", () => {
  const base = { guestName: "Riya", propertyName: "Lawei Homestay", amountDue: "₹2,500" };
  it("request/reminder include the amount and optional UPI", () => {
    expect(paymentRequest({ ...base, upiVpa: "lawei@okhdfcbank" }).body).toContain("lawei@okhdfcbank");
    expect(paymentRequest(base).body).toContain("₹2,500");
    const rem = paymentReminder(base).body;
    expect(rem).toContain("₹2,500");
    expect(rem.toLowerCase()).toContain("reminder");
    expect(rem).not.toMatch(/undefined|null|\{\{/);
  });
});
