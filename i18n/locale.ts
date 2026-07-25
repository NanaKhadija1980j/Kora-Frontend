/**
 * Locale detection and persistence utilities.
 *
 * Priority order:
 *  1. kora-locale cookie (user's explicit choice or middleware-detected preference)
 *  2. browser Accept-Language header (detected from navigator.language)
 *  3. default locale ("en")
 */
import { locales, defaultLocale, type Locale } from "./config";

export const LOCALE_COOKIE_NAME = "kora-locale";
/** 30-day cookie lifetime */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Shared cookie attributes for locale persistence. */
export function getLocaleCookieOptions(isProduction: boolean) {
  return {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    secure: isProduction,
  };
}

/** Validate and normalise a raw locale string. */
export function parseLocale(value: string | undefined | null): Locale | null {
  if (!value) return null;
  const base = value.split("-")[0].toLowerCase();
  if (locales.includes(base as Locale)) return base as Locale;
  return null;
}

/**
 * Detect the best locale from an Accept-Language header value.
 * Falls back to the default locale if no match is found.
 */
export function detectLocaleFromAcceptLanguage(acceptLanguage: string): Locale {
  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0].trim().split("-")[0].toLowerCase());

  for (const lang of preferred) {
    if (locales.includes(lang as Locale)) return lang as Locale;
  }
  return defaultLocale;
}

/** Detect the best locale from the browser's language preference. */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return defaultLocale;

  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const lang of languages) {
    const base = lang.split("-")[0].toLowerCase();
    const parsed = parseLocale(base);
    if (parsed) return parsed;
  }

  return defaultLocale;
}

/** Read the persisted locale from the kora-locale cookie (client-side). */
export function getCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE_NAME}=`));

  if (!match) return null;
  const value = decodeURIComponent(match.slice(LOCALE_COOKIE_NAME.length + 1));
  return parseLocale(value);
}

/** Persist the user's locale choice to the kora-locale cookie (client-side). */
export function setCookieLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  if (!locales.includes(locale)) return;

  const isProduction = process.env.NODE_ENV === "production";
  const { path, maxAge, sameSite, secure } = getLocaleCookieOptions(isProduction);

  const parts = [
    `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}`,
    `path=${path}`,
    `max-age=${maxAge}`,
    `SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`,
  ];
  if (secure) parts.push("Secure");

  document.cookie = parts.join("; ");
}

/** Resolve the active locale using the priority chain. */
export function resolveLocale(): Locale {
  return getCookieLocale() ?? detectBrowserLocale();
}

/** Resolve locale for middleware: cookie → Accept-Language → default. */
export function resolveLocaleFromRequest(
  cookieValue: string | undefined,
  acceptLanguage: string
): Locale {
  return parseLocale(cookieValue) ?? detectLocaleFromAcceptLanguage(acceptLanguage);
}
