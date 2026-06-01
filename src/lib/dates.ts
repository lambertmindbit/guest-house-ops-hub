import { z } from "zod";

// All stays use date-only values (no time component). We anchor them to UTC
// midnight so a "YYYY-MM-DD" round-trips through Postgres DATE columns without
// drifting across timezones — the property's calendar date is the reference.

export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Today's calendar date as YYYY-MM-DD, in the property's local timezone.
export function todayDateOnly(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const d = parseDateOnly(value);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}
