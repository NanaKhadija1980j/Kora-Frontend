"use client";

/**
 * Client-side locale provider.
 *
 * Wraps next-intl's NextIntlClientProvider and handles:
 *  - Initial locale resolution (cookie → browser → default)
 *  - Locale switching with cookie persistence
 *  - Exposing `useLocale` and `useSetLocale` to the component tree
 *  - Setting dir and lang attributes on html element
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { NextIntlClientProvider } from "next-intl";
import { defaultLocale, locales, type Locale, isRTL } from "./config";
import { resolveLocale, setCookieLocale } from "./locale";

// ─── Context ──────────────────────────────────────────────────────────────────

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

interface LocaleProviderProps {
  children: React.ReactNode;
  /** Pre-loaded messages for all supported locales, keyed by locale code. */
  allMessages: Record<Locale, Record<string, unknown>>;
  /**
   * Locale resolved on the server (middleware `x-kora-locale` header) and
   * passed down from the root layout. Used as the initial state so the first
   * client render matches the SSR `lang`/`dir` and avoids a post-mount flip.
   */
  initialLocale?: Locale;
}

export function LocaleProvider({
  children,
  allMessages,
  initialLocale,
}: LocaleProviderProps) {
  // Seed with the server-resolved locale so the first client render matches
  // SSR. Fall back to the default when no server locale is provided.
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale ?? defaultLocale
  );

  // Update document lang and dir attributes when locale changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = isRTL(locale) ? "rtl" : "ltr";
    }
  }, [locale]);

  useEffect(() => {
    // Only reconcile with the client-resolved locale when the server did not
    // already provide one; otherwise keep the SSR locale to avoid a flip.
    if (initialLocale) return;
    const resolved = resolveLocale();
    setLocaleState(resolved);
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    if (!locales.includes(next)) return;
    setLocaleState(next);
    setCookieLocale(next);
  }, []);

  const messages = allMessages[locale] ?? allMessages[defaultLocale];

  const contextValue = useMemo(
    () => ({ locale, setLocale }),
    [locale, setLocale]
  );

  return (
    <LocaleContext.Provider value={contextValue}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Returns the currently active locale code. */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/** Returns a setter to switch the active locale. */
export function useSetLocale(): (locale: Locale) => void {
  return useContext(LocaleContext).setLocale;
}
