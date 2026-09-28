import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";
import { LOCALE_COOKIE_NAME, parseLocale } from "./locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const fromCookie = parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const fromHeader = parseLocale(headerStore.get("x-kora-locale"));
  const resolvedLocale: Locale = fromCookie ?? fromHeader ?? defaultLocale;
  const locale: Locale = locales.includes(resolvedLocale) ? resolvedLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Fixed to UTC: Kora deals in on-chain timestamps (invoice due dates,
    // transaction confirmations) that should read the same regardless of
    // where the server or client happens to be, and an unset timeZone risks
    // server/client hydration mismatches in next-intl's date formatting.
    timeZone: "UTC",
  };
});
