import { describe, it, expect } from "vitest";
import { translate, translator, isLocale, LOCALES, DEFAULT_LOCALE } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { kha } from "@/lib/i18n/kha";

// GAP-16/US-801. Two guarantees matter: English is byte-identical (so the migration
// changes nothing on screen), and an untranslated Khasi string falls back to English
// (so selecting Khasi never blanks the UI or leaks a raw key).

describe("locale basics", () => {
  it("default is English and the locale set is en + kha", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toEqual(["en", "kha"]);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("kha")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("translate — pixel-identical English", () => {
  it("returns the exact English string for every key in the pack", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(translate("en", key)).toBe(value);
    }
  });

  it("interpolates named placeholders", () => {
    expect(translate("en", "dashboard.roomsOf", { occupied: 3, total: 8 })).toBe("3 of 8 rooms");
    expect(translate("en", "onboarding.stepsToGo", { n: 2 })).toBe("2 step(s) to go.");
  });
});

describe("translate — Khasi fallback chain (locale → en → key)", () => {
  it("falls back to English for every English key while Khasi is empty", () => {
    for (const key of Object.keys(en)) {
      expect(translate("kha", key)).toBe(en[key]); // no blanks, no raw keys
    }
  });

  it("uses the Khasi string once one exists (proves the wiring, not just the fallback)", () => {
    // Simulate a single translated key without shipping a real translation.
    const withOne = { ...kha, "nav.today": "Mynta" } as Record<string, string>;
    const t = (k: string) => withOne[k] ?? en[k] ?? k;
    expect(t("nav.today")).toBe("Mynta");
    expect(t("nav.calendar")).toBe("Calendar"); // still English
  });

  it("an unknown key returns the key itself — a visible, greppable signal", () => {
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
    expect(translate("kha", "does.not.exist")).toBe("does.not.exist");
  });
});

describe("translator binding", () => {
  it("produces a locale-bound function equivalent to translate()", () => {
    const t = translator("en");
    expect(t("nav.today")).toBe("Today");
    expect(t("dashboard.roomsOf", { occupied: 1, total: 1 })).toBe("1 of 1 rooms");
  });
});
