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

// The property's IANA timezone. The app is single-property; the calendar date
// that matters is the PROPERTY's, not the server's. On Vercel the Node runtime
// is UTC, so deriving "today" from the server's offset silently returned the
// wrong day during the small hours in +offset zones (e.g. 00:00–05:30 IST).
// Configure via APP_TIMEZONE; defaults to PropertySettings.timezone's default.
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

// The calendar date (YYYY-MM-DD) an instant falls on in a given IANA timezone.
// `en-CA` renders a date as YYYY-MM-DD, and the `timeZone` option makes Intl
// resolve the wall-clock date in that zone wherever the code runs.
export function dateInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

// Today's calendar date as YYYY-MM-DD, in the PROPERTY's timezone (not the
// server's).
export function todayDateOnly(): string {
  return dateInTimeZone(new Date(), APP_TIMEZONE);
}

export function addDays(value: string, days: number): string {
  const d = parseDateOnly(value);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}
