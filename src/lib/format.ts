import { format } from "date-fns";
import type { Prisma } from "@prisma/client";

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

export function displayINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function displayMoney(amount: Prisma.Decimal | null): string {
  if (amount === null) return "—";
  return displayINR(Number(amount));
}

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank transfer",
  ota_collect: "OTA collected",
};
