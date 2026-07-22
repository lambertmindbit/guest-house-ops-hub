import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, translator, type Locale, type TranslateFn } from "./index";

// Server-side locale + translator, read from the per-device cookie. Used in Server
// Components and route handlers.
export async function getLocale(): Promise<Locale> {
  try {
    const v = (await cookies()).get(LOCALE_COOKIE)?.value;
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE; // outside a request (build, tests)
  }
}

export async function getT(): Promise<TranslateFn> {
  return translator(await getLocale());
}
