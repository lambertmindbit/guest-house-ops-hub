"use client";

import { createContext, useContext } from "react";
import { translator, type Locale, type TranslateFn } from "@/lib/i18n";

// Client-side locale context. The server layout reads the cookie once and provides
// the locale here; useT() builds the same translator the server uses, so SSR and
// client render identical text (no hydration mismatch).
const Ctx = createContext<{ locale: Locale; t: TranslateFn }>({ locale: "en", t: translator("en") });

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, t: translator(locale) }}>{children}</Ctx.Provider>;
}

export function useT(): TranslateFn {
  return useContext(Ctx).t;
}

export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
