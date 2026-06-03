// Best-effort parser for OTA confirmation emails. Pure + dependency-free so it's
// unit-testable. It extracts what it can and leaves the rest null — the owner
// corrects fields on the review screen before a booking is created.
//
// IMPORTANT: the per-OTA regexes below are SCAFFOLDING. They must be validated
// and tuned against REAL Booking.com / Agoda / MakeMyTrip emails before relying
// on automated import — paste a few real samples and adjust. The review step
// makes mis-parses safe in the meantime.

export type ParsedBooking = {
  source: string; // "Booking.com" | "Agoda" | "MakeMyTrip" | "Unknown"
  otaRef: string | null;
  guestName: string | null;
  guestPhone: string | null;
  checkIn: string | null; // YYYY-MM-DD
  checkOut: string | null; // YYYY-MM-DD
  roomTypeHint: string | null;
  amount: number | null;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function detectSource(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("booking.com")) return "Booking.com";
  if (s.includes("agoda")) return "Agoda";
  if (/make\s?my\s?trip|makemytrip|\bmmt\b/.test(s)) return "MakeMyTrip";
  return "Unknown";
}

// Parse a loose date string ("2026-07-12", "12 Jul 2026", "July 12, 2026") to
// YYYY-MM-DD. Returns null if nothing date-like is found.
export function parseLooseDate(text: string): string | null {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const pad = (n: number) => String(n).padStart(2, "0");

  // "12 July 2026" / "12 Jul 2026"
  const dmy = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
  if (dmy) {
    const m = MONTHS[dmy[2].slice(0, 3).toLowerCase()];
    if (m) return `${dmy[3]}-${pad(m)}-${pad(Number(dmy[1]))}`;
  }
  // "July 12, 2026" / "Jul 12 2026"
  const mdy = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (mdy) {
    const m = MONTHS[mdy[1].slice(0, 3).toLowerCase()];
    if (m) return `${mdy[3]}-${pad(m)}-${pad(Number(mdy[2]))}`;
  }
  return null;
}

function firstGroup(raw: string, re: RegExp): string | null {
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}

export function parseBookingEmail(raw: string): ParsedBooking {
  const source = detectSource(raw);

  const checkInLine = firstGroup(raw, /check[\s-]?in[^\n:]*[:\s]+([^\n]+)/i);
  const checkOutLine = firstGroup(raw, /check[\s-]?out[^\n:]*[:\s]+([^\n]+)/i);

  const otaRef = firstGroup(
    raw,
    /(?:booking(?:\s*(?:number|id|no\.?|reference))?|reservation(?:\s*id)?|itinerary(?:\s*(?:no\.?|number|id))?|confirmation(?:\s*(?:number|code|no\.?))?)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,})/i,
  );

  const guestName = firstGroup(
    raw,
    /(?:guest\s*name|guest|name|booker)\s*[:]\s*([A-Z][A-Za-z .'-]{1,40})/,
  );

  // Prefer a labelled phone line; fall back to a long phone-like run (kept long
  // enough to avoid grabbing a booking/reference number).
  const guestPhone =
    firstGroup(raw, /(?:phone|mobile|contact|tel)\s*[:]\s*(\+?[\d][\d\s-]{6,}\d)/i) ??
    firstGroup(raw, /(\+?\d[\d\s-]{10,}\d)/);

  const roomTypeHint = firstGroup(raw, /(?:room\s*type|room|accommodation)\s*[:]\s*([^\n]{2,40})/i);

  const amountStr = firstGroup(
    raw,
    /(?:total|grand\s*total|amount|price)[^\d₹]{0,15}(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  const amount = amountStr ? Number(amountStr.replace(/,/g, "")) : null;

  return {
    source,
    otaRef,
    guestName,
    guestPhone,
    checkIn: checkInLine ? parseLooseDate(checkInLine) : null,
    checkOut: checkOutLine ? parseLooseDate(checkOutLine) : null,
    roomTypeHint,
    amount: amount != null && Number.isFinite(amount) ? amount : null,
  };
}
