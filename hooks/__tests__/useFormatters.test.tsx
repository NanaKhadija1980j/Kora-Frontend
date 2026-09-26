import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PropsWithChildren } from "react";

import { useFormatters } from "../useFormatters";
import type { Locale } from "@/i18n/config";

const localeState = vi.hoisted(() => ({
  value: "en" as Locale,
}));

vi.mock("@/i18n/LocaleProvider", () => ({
  useLocale: () => localeState.value,
}));

const localeCases: Array<{
  locale: Locale;
  intlLocale: string;
  currency: string;
  apr: string;
  date: string;
}> = [
  {
    locale: "en",
    intlLocale: "en-US",
    currency: "$1,234.56 USDC",
    apr: "12.50% APR",
    date: "Jan 15, 2025",
  },
  {
    locale: "es",
    intlLocale: "es-ES",
    currency: "$1.234,56 USDC",
    apr: "12,50% APR",
    date: "15 ene 2025",
  },
  {
    locale: "ar",
    intlLocale: "ar-SA",
    currency: "١٬٢٣٤٫٥٦ $ USDC",
    apr: "١٢٫٥٠% APR",
    date: "١٥ يناير ٢٠٢٥",
  },
  {
    locale: "pt-BR",
    intlLocale: "pt-BR",
    currency: "$1.234,56 USDC",
    apr: "12,50% APR",
    date: "15 de jan. de 2025",
  },
];

function createWrapper(intlLocale: string) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <NextIntlClientProvider
        locale={intlLocale}
        messages={{}}
        timeZone="UTC"
      >
        {children}
      </NextIntlClientProvider>
    );
  };
}

describe("useFormatters — locale regressions", () => {
  it.each(localeCases)(
    "formats currency, APR, and dates correctly for $locale",
    ({ locale, intlLocale, currency, apr, date }) => {
      localeState.value = locale;

      const { result } = renderHook(() => useFormatters(), {
        wrapper: createWrapper(intlLocale),
      });

      expect(result.current.formatCurrency(1234.56)).toBe(currency);
      expect(result.current.formatApr(12.5)).toBe(apr);
      expect(
        result.current.formatDate("2025-01-15T12:00:00Z"),
      ).toBe(date);
    },
  );
});