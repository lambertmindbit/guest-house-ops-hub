// ID-collection policy (pure, unit-tested). A booking may be taken in advance
// with just name + phone, but a guest cannot be CHECKED IN until their government
// ID is recorded — the arrival + legal-registration moment. Foreign nationals
// additionally need the C-Form (passport) completed.

export type GuestIdFields = {
  idNumber: string | null;
  idUploaded: boolean;
  idChecked: boolean;
  idVerificationCompleted: boolean;
  nationality: string | null;
  passportNumber: string | null;
};

const has = (s: string | null | undefined) => !!(s && s.trim());

// ID is "on file" when any concrete evidence is recorded: a scanned document, an
// ID number, a passport (foreigners), or the owner's checked/verified ticks.
export function hasIdOnFile(g: GuestIdFields): boolean {
  return g.idVerificationCompleted || g.idUploaded || g.idChecked || has(g.idNumber) || has(g.passportNumber);
}

// A guest is treated as a foreign national once a nationality is recorded (the
// C-Form section only applies to foreigners).
export function isForeignGuest(g: GuestIdFields): boolean {
  return has(g.nationality);
}

// Why check-in is blocked, or null if it may proceed. This is the single source
// of truth for the hard check-in gate (server) and the disabled-button UX (page).
export function checkInBlockReason(g: GuestIdFields): string | null {
  if (!hasIdOnFile(g)) return "Record the guest's government ID before check-in.";
  if (isForeignGuest(g) && !has(g.passportNumber)) return "Complete the C-Form (passport details) for this foreign guest before check-in.";
  return null;
}
