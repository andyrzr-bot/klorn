import { describe, expect, it } from "vitest";
import { CATALOGS, createTranslator, LOCALES, matchLocale, placeholdersOf } from "./index";
import { en } from "./locales/en";

describe("i18n parity across the 7 locales", () => {
  const keys = Object.keys(en).sort();

  it.each(LOCALES)("%s has exactly the English keys", (locale) => {
    expect(Object.keys(CATALOGS[locale]).sort()).toEqual(keys);
  });

  it.each(LOCALES)("%s keeps every placeholder and leaves nothing empty", (locale) => {
    for (const key of keys) {
      const value = (CATALOGS[locale] as Record<string, string>)[key] ?? "";
      expect(value.trim(), `${locale} ${key}`).not.toBe("");
      expect(placeholdersOf(value), `${locale} ${key}`).toEqual(
        placeholdersOf((en as Record<string, string>)[key] ?? ""),
      );
    }
  });

  it.each(LOCALES)("%s follows the product vocabulary", (locale) => {
    for (const [key, value] of Object.entries(CATALOGS[locale])) {
      // Retired v1 lanes never appear in copy; neither do retired screen names.
      expect(value, `${locale} ${key}`).not.toMatch(/\b(AUTO|CALL)\b/);
      expect(value, `${locale} ${key}`).not.toMatch(/firewall|decision queue/i);
    }
  });

  it("lane names are never translated", () => {
    for (const locale of LOCALES) {
      const t = createTranslator(locale);
      expect(t.t("today.brief.emptyTitle")).toContain("PUSH");
      expect(t.tn("today.lanes.count", 14, { lane: "QUEUE" })).toContain("QUEUE");
    }
  });
});

describe("translator", () => {
  it("defaults to the device locale, else English", () => {
    expect(matchLocale(["ko-KR", "en-US"])).toBe("ko");
    expect(matchLocale(["zh-Hant-TW"])).toBe("zh");
    expect(matchLocale(["pt-BR", "de-AT"])).toBe("de");
    expect(matchLocale(["pt-BR"])).toBe("en");
    expect(matchLocale([])).toBe("en");
  });

  it("interpolates and pluralises", () => {
    const en = createTranslator("en");
    expect(en.tn("today.replies", 1)).toBe("1 email needs a reply");
    expect(en.tn("today.replies", 2)).toBe("2 emails need a reply");
    expect(en.t("today.summary.both", { replies: "a", meetings: "b" })).toBe(
      "a, and you have b today.",
    );
    const ko = createTranslator("ko");
    expect(
      ko.t("today.summary.both", {
        replies: ko.tn("today.replies", 2),
        meetings: ko.tn("today.meetings", 3),
      }),
    ).toBe("답장이 필요한 메일 2개, 회의가 3개 있어요.");
    expect(createTranslator("fr").tn("today.meetings", 0)).toBe("0 réunion");
  });
});
