import { format } from "date-fns";
import type { Prisma } from "@prisma/client";

// DATE columns come back from Prisma as Date objects at UTC midnight. Build a
// local Date from the UTC parts so display never shifts across the day boundary.
export function displayDate(date: Date): string {
  const local = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return format(local, "EEE d MMM");
}

export function displayShortDate(date: Date): string {
  const local = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return format(local, "d MMM");
}

export function displayMoney(amount: Prisma.Decimal | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}
