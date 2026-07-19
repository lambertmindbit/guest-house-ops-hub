// Form C (foreign-guest FRRO registration) helpers (GAP-7). Indian law requires
// reporting a foreign guest within 24h of arrival; the hub captures the fields and
// this drives the reminder + the "submitted" gate. Pure so it's testable.

// Foreign detection is nationality-driven (Q-OPS-10): a set nationality that isn't
// Indian. Blank nationality = treat as domestic (no Form C prompt).
export function isForeignGuest(nationality: string | null | undefined): boolean {
  const n = nationality?.trim().toLowerCase();
  if (!n) return false;
  return n !== "indian" && n !== "india" && n !== "in";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export type FormCStatus = {
  applies: boolean; // foreign guest, so a Form C is required
  submitted: boolean;
  hoursSinceCheckIn: number | null; // null if not checked in yet
  overdue: boolean; // checked in > 24h ago and still not submitted
};

// The Form C reminder state for one arrival. The reminder is "due" from check-in
// until the owner ticks submitted; it turns overdue past the 24h legal window.
export function formCStatus(
  input: { nationality: string | null | undefined; checkedInAt: Date | null; formCSubmittedAt: Date | null },
  now: Date,
): FormCStatus {
  const applies = isForeignGuest(input.nationality);
  const submitted = input.formCSubmittedAt !== null;
  const hoursSinceCheckIn = input.checkedInAt ? Math.max(0, (now.getTime() - input.checkedInAt.getTime()) / 3_600_000) : null;
  const overdue = applies && !submitted && input.checkedInAt !== null && now.getTime() - input.checkedInAt.getTime() > DAY_MS;
  return { applies, submitted, hoursSinceCheckIn, overdue };
}

// Reminder is shown while a checked-in foreign guest's Form C is unfiled.
export function formCReminderDue(
  input: { nationality: string | null | undefined; checkedInAt: Date | null; formCSubmittedAt: Date | null },
): boolean {
  return isForeignGuest(input.nationality) && input.checkedInAt !== null && input.formCSubmittedAt === null;
}
