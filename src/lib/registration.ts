// Pure helpers that map a guest record into the labelled rows shown on the
// printable registration / C-Form card. Kept free of Prisma types and the DB so
// they're unit-testable; the page passes pre-formatted date strings in.

export type RegistrationGuest = {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  vehicleNumber?: string | null;
  idNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  preferences?: string[];
  idChecked?: boolean;
  idPhotocopied?: boolean;
  idUploaded?: boolean;
  idVerificationCompleted?: boolean;
  // C-Form — date fields are pre-formatted display strings.
  nationality?: string | null;
  passportNumber?: string | null;
  passportIssuePlace?: string | null;
  passportIssueDate?: string | null;
  passportExpiry?: string | null;
  visaNumber?: string | null;
  visaType?: string | null;
  visaIssuePlace?: string | null;
  visaIssueDate?: string | null;
  visaExpiry?: string | null;
  portOfEntry?: string | null;
  arrivalInIndia?: string | null;
  purposeOfVisit?: string | null;
};

export type RegRow = { label: string; value: string };

const val = (v?: string | null) => (v && v.trim() ? v.trim() : "—");

function emergency(g: RegistrationGuest): string {
  const name = g.emergencyContactName?.trim();
  const phone = g.emergencyContactPhone?.trim();
  if (name && phone) return `${name} · ${phone}`;
  return val(name || phone);
}

export function guestRegistrationRows(g: RegistrationGuest): RegRow[] {
  return [
    { label: "Name", value: val(g.name) },
    { label: "Phone", value: val(g.phone) },
    { label: "Email", value: val(g.email) },
    { label: "Address", value: val(g.address) },
    { label: "Vehicle number", value: val(g.vehicleNumber) },
    { label: "ID number", value: val(g.idNumber) },
    { label: "Emergency contact", value: emergency(g) },
    { label: "Preferences", value: g.preferences?.length ? g.preferences.join(", ") : "—" },
  ];
}

// A guest is treated as a foreign national (C-Form needed) once nationality is set.
export function isForeignNational(g: RegistrationGuest): boolean {
  return !!(g.nationality && g.nationality.trim());
}

export function cformRows(g: RegistrationGuest): RegRow[] {
  return [
    { label: "Nationality", value: val(g.nationality) },
    { label: "Passport no.", value: val(g.passportNumber) },
    { label: "Passport issue place", value: val(g.passportIssuePlace) },
    { label: "Passport issue date", value: val(g.passportIssueDate) },
    { label: "Passport expiry", value: val(g.passportExpiry) },
    { label: "Visa no.", value: val(g.visaNumber) },
    { label: "Visa type", value: val(g.visaType) },
    { label: "Visa issue place", value: val(g.visaIssuePlace) },
    { label: "Visa issue date", value: val(g.visaIssueDate) },
    { label: "Visa expiry", value: val(g.visaExpiry) },
    { label: "Port of entry", value: val(g.portOfEntry) },
    { label: "Arrival in India", value: val(g.arrivalInIndia) },
    { label: "Purpose of visit", value: val(g.purposeOfVisit) },
  ];
}

export function idComplianceRows(g: RegistrationGuest): { label: string; done: boolean }[] {
  return [
    { label: "ID checked", done: !!g.idChecked },
    { label: "ID photocopied", done: !!g.idPhotocopied },
    { label: "ID uploaded", done: !!g.idUploaded },
    { label: "Verification completed", done: !!g.idVerificationCompleted },
  ];
}
