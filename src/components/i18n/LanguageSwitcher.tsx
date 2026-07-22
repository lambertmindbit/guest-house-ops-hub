"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { useLocale, useT } from "./LocaleProvider";

// Per-device language switch. Writes the NEXT_LOCALE cookie and refreshes so the
// server re-renders in the chosen language. One year, lax — a UI preference, not
// sensitive.
export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useT();

  function choose(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="card card--pad">
      <div className="h3">{t("settings.language")}</div>
      <div className="muted" style={{ fontSize: "var(--fs-small)", marginTop: 4 }}>{t("settings.language.sub")}</div>
      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {LOCALES.map((l) => (
          <button
            key={l}
            onClick={() => choose(l)}
            className={`btn btn--sm ${l === locale ? "btn--primary" : "btn--ghost"}`}
            aria-pressed={l === locale}
          >
            {t(`settings.language.${l}`)}
          </button>
        ))}
      </div>
      {locale === "kha" && (
        <div className="field-hint" style={{ marginTop: 10 }}>{t("settings.language.khaComingSoon")}</div>
      )}
    </div>
  );
}
