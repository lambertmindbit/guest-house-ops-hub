// Pure message templates. No DB, no Prisma — callers pass pre-formatted values,
// so these render deterministically and are unit-testable. Adding a template is
// just another pure function here; the messaging seam (messaging.ts) renders one
// and hands the text to the LogAdapter (and, later, a real provider).

export type TemplateName = "bookingConfirmation" | "preArrivalDirections" | "paymentRequest" | "paymentReminder";

export type BookingConfirmationData = {
  guestName: string;
  propertyName: string;
  roomLabel: string;
  checkIn: string; // pre-formatted display date, e.g. "Mon, 1 Jun 2026"
  checkOut: string;
  nights: number;
};

export function bookingConfirmation(d: BookingConfirmationData): { body: string } {
  const nightWord = d.nights === 1 ? "night" : "nights";
  return {
    body:
      `Hi ${d.guestName}, your booking at ${d.propertyName} is confirmed. ` +
      `Room ${d.roomLabel}, ${d.checkIn} to ${d.checkOut} (${d.nights} ${nightWord}). ` +
      `We look forward to hosting you.`,
  };
}

export type PreArrivalData = {
  guestName: string;
  propertyName: string;
  checkIn: string;
  checkInTime: string; // "14:00"
  address?: string | null;
};

export function preArrivalDirections(d: PreArrivalData): { body: string } {
  const where = d.address ? ` We're at ${d.address}.` : "";
  return {
    body:
      `Hi ${d.guestName}, we look forward to welcoming you to ${d.propertyName} on ${d.checkIn}. ` +
      `Check-in is from ${d.checkInTime}.${where} ` +
      `Reply here if you need directions or help with transport.`,
  };
}

export type PaymentData = {
  guestName: string;
  propertyName: string;
  amountDue: string; // pre-formatted, e.g. "₹2,500"
  upiVpa?: string | null;
};

export function paymentRequest(d: PaymentData): { body: string } {
  const upi = d.upiVpa ? ` You can pay by UPI to ${d.upiVpa}.` : "";
  return {
    body:
      `Hi ${d.guestName}, to confirm your stay at ${d.propertyName} please pay ${d.amountDue}.${upi} ` +
      `Do share a screenshot once done — thank you.`,
  };
}

export function paymentReminder(d: PaymentData): { body: string } {
  const upi = d.upiVpa ? ` UPI: ${d.upiVpa}.` : "";
  return {
    body:
      `Hi ${d.guestName}, a gentle reminder that ${d.amountDue} is still pending for your stay at ${d.propertyName}.${upi} ` +
      `Please clear it before arrival — thank you.`,
  };
}
