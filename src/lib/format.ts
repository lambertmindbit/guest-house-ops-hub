import { format } from "date-fns";
import { formatPaise, type Money } from "@/lib/money";

// DATE columns come back from Prisma as Date objects at UTC midnight. Build a
// local Date from the UTC parts so display never shifts across the day boundary.
// The one full date format across the app (guide §6): "Mon, 1 Jun 2026".
// Compact contexts use displayShortDate ("1 Jun").
export function displayDate(date: Date): string {
  const local = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return format(local, "EEE, d MMM yyyy");
}

export function displayShortDate(date: Date): string {
  const local = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return format(local, "d MMM");
}

// Indian DD-Mon-YYYY, e.g. "10-Jul-2026". Takes a plain "YYYY-MM-DD" string (the
// wire format the assistant's GenUI cards carry) rather than a Date, so callers
// don't need to construct one just to display it.
export function displayDMY(isoDateOnly: string): string {
  const [y, m, d] = isoDateOnly.split("-").map(Number);
  return format(new Date(y, m - 1, d), "dd-MMM-yyyy");
}

// Money is integer paise (GAP-9). Both formatters take paise and render "₹1,234"
// (whole rupees) or "₹1,234.50" (sub-rupee) via the single money formatter. Server
// components pass a bigint straight from Prisma; client components pass the number
// paise they received over the wire.
export function displayINR(paise: Money | number | bigint): string {
  return formatPaise(paise as Money | bigint);
}

export function displayMoney(paise: Money | number | bigint | null): string {
  return formatPaise(paise as Money | bigint | null);
}

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank transfer",
  ota_collect: "OTA collected",
};
