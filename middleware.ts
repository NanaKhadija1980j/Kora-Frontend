import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LOCALE_COOKIE_NAME,
  getLocaleCookieOptions,
  resolveLocaleFromRequest,
} from "@/i18n/locale";
import { locales, defaultLocale } from "@/i18n/config";

const PROTECTED = ["/invoice/create"];

/**
 * Detect the best locale from the Accept-Language header.
 * Falls back to the default locale if no match is found.
 */
function detectLocaleFromHeader(req: NextRequest): string {
  const acceptLanguage = req.headers.get("accept-language") ?? "";
  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0].trim().split("-")[0].toLowerCase());

  for (const lang of preferred) {
    if (locales.includes(lang as (typeof locales)[number])) return lang;
  }
  return defaultLocale;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ── X-Request-ID (#277) ───────────────────────────────────────────────────
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  // ── Locale: read cookie for SSR, fall back to Accept-Language ─────────────
  const acceptLanguage = req.headers.get("accept-language") ?? "";
  const cookieValue = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const locale = resolveLocaleFromRequest(cookieValue, acceptLanguage);
  requestHeaders.set("x-kora-locale", locale);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);

  if (!cookieValue || cookieValue !== locale) {
    response.cookies.set(LOCALE_COOKIE_NAME, locale, getLocaleCookieOptions(process.env.NODE_ENV === "production"));
  }

  // ── Protected route guard ─────────────────────────────────────────────────
  for (const p of PROTECTED) {
    if (pathname === p || pathname.startsWith(p + "/")) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("redirectTo", pathname + (search || ""));
      const redirect = NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
      redirect.headers.set("x-request-id", requestId);
      if (!cookieValue || cookieValue !== locale) {
        redirect.cookies.set(
          LOCALE_COOKIE_NAME,
          locale,
          getLocaleCookieOptions(process.env.NODE_ENV === "production")
        );
      }
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|wallets|manifest.json).*)",
  ],
};
