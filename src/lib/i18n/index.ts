import { en } from "./en";
import { kha } from "./kha";

// Minimal, dependency-free i18n (GAP-16/US-801). Two languages, so a typed t() over
// plain dictionaries is the right amount of machinery — no framework, no new
// dependency, and English renders byte-identically because en.ts holds the exact
// prior strings. Locale is a per-device cookie (right for a shared front desk).

export type Locale = "en" | "kha";
export const LOCALES: Locale[] = ["en", "kha"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

const TABLES: Record<Locale, Record<string, string>> = { en, kha };

export function isLocale(v: string | undefined | null): v is Locale {
  return v === "en" || v === "kha";
}

// Look up a key with a three-step fallback: chosen locale → English → the key
// itself. So an untranslated Khasi string shows English (never a blank), and a
// genuinely-unknown key shows its name (a visible, greppable signal) rather than
// throwing. Placeholders are {name}.
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let s = TABLES[locale]?.[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

// A translator bound to one locale — used by both the server helper and the client
// hook so their output can never diverge.
export function translator(locale: Locale): TranslateFn {
  return (key, vars) => translate(locale, key, vars);
}
