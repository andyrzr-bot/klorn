/**
 * i18n core — pure, no React. Seven app languages; the default is the device
 * locale (navigator.languages, which the Capacitor WebView takes from the OS),
 * overridable in Accounts. This is the APP language only — notification
 * language is a server setting and reply language follows the mail
 * (docs/product-vocabulary.md, "Two different language settings").
 */
import { de } from "./locales/de";
import { en, type MessageKey, type Messages } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import { zh } from "./locales/zh";

export const LOCALES = ["en", "ko", "ja", "zh", "es", "fr", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export type { MessageKey, Messages };

export const CATALOGS: Record<Locale, Messages> = { en, ko, ja, zh, es, fr, de };

/** Each language's own name, shown in the language picker (never translated). */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "简体中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

/** BCP 47 tag handed to Intl for each app language. */
export const INTL_TAGS: Record<Locale, string> = {
  en: "en",
  ko: "ko-KR",
  ja: "ja-JP",
  zh: "zh-CN",
  es: "es",
  fr: "fr",
  de: "de",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** First supported language among the device's preferred tags, else English. */
export function matchLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(primary)) return primary;
  }
  return "en";
}

export function deviceLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  return matchLocale(tags.filter(Boolean));
}

export type Params = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Names inside `{…}` in a message — the parity test compares these per key. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1] ?? "").sort();
}

/** Keys with plural forms, by their base (`today.replies` for `today.replies.one`/`.other`). */
export type PluralBase = MessageKey extends infer K
  ? K extends `${infer Base}.other`
    ? Base
    : never
  : never;

export interface Translator {
  locale: Locale;
  intlTag: string;
  t(key: MessageKey, params?: Params): string;
  /** Plural-aware: picks `<base>.<rule>` (falling back to `.other`), with `{count}`. */
  tn(base: PluralBase, count: number, params?: Params): string;
}

export function createTranslator(locale: Locale): Translator {
  const messages = CATALOGS[locale];
  const intlTag = INTL_TAGS[locale];
  const rules = new Intl.PluralRules(intlTag);
  const lookup = (key: string): string =>
    (messages as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
  return {
    locale,
    intlTag,
    t: (key, params) => interpolate(lookup(key), params),
    tn: (base, count, params) => {
      const rule = rules.select(count);
      const key = rule === "one" ? `${base}.one` : `${base}.other`;
      return interpolate(lookup(key), { count, ...params });
    },
  };
}
