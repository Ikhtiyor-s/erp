"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import uz from "./messages/uz.json";
import ru from "./messages/ru.json";
import en from "./messages/en.json";
import uzCyrl from "./messages/uz-cyrl.json";

export type Locale = "uz" | "ru" | "en" | "uz-cyrl";

const MESSAGES: Record<Locale, any> = { uz, ru, en, "uz-cyrl": uzCyrl };

type Ctx = { locale: Locale; setLocale: (l: Locale) => void };
const LocaleCtx = createContext<Ctx>({ locale: "uz", setLocale: () => {} });

export const useLocale = () => useContext(LocaleCtx);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("uz");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && ["uz", "ru", "en", "uz-cyrl"].includes(saved)) setLocaleState(saved);
    setMounted(true);
  }, []);

  function setLocale(l: Locale) {
    localStorage.setItem("locale", l);
    setLocaleState(l);
    document.documentElement.lang = l;
  }

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Render with default (uz) on first SSR pass to avoid hydration mismatch
  const messages = MESSAGES[locale];

  return (
    <LocaleCtx.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Tashkent">
        {children}
      </NextIntlClientProvider>
    </LocaleCtx.Provider>
  );
}
