// Pure message templates. No DB, no Prisma — callers pass pre-formatted values,
// so these render deterministically and are unit-testable. Adding a template is
// just another pure function here; the messaging seam (messaging.ts) renders one
// and hands the text to the LogAdapter (and, later, a real provider).

export type TemplateName = "bookingConfirmation";

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
