import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { kv } from "../platform/kv";
import { createTranslator, deviceLocale, isLocale, type Locale, type Translator } from "./index";

const OVERRIDE_KEY = "klorn-locale";

interface I18nValue extends Translator {
  /** null = follow the device. */
  override: Locale | null;
  setOverride(locale: Locale | null): void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<Locale>(() => deviceLocale());
  const [override, setOverrideState] = useState<Locale | null>(null);

  useEffect(() => {
    void kv.getItem(OVERRIDE_KEY).then((stored) => {
      if (isLocale(stored)) setOverrideState(stored);
    });
    const onChange = () => setDevice(deviceLocale());
    window.addEventListener("languagechange", onChange);
    return () => window.removeEventListener("languagechange", onChange);
  }, []);

  const locale = override ?? device;
  const value = useMemo<I18nValue>(() => {
    const translator = createTranslator(locale);
    return {
      ...translator,
      override,
      setOverride(next) {
        setOverrideState(next);
        if (next) void kv.setItem(OVERRIDE_KEY, next);
        else void kv.removeItem(OVERRIDE_KEY);
      },
    };
  }, [locale, override]);

  useEffect(() => {
    document.documentElement.lang = value.intlTag;
  }, [value.intlTag]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n outside I18nProvider");
  return value;
}
