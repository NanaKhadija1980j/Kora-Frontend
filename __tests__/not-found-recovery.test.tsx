/**
 * 404 recovery links — Issue #693.
 *
 * Renders the real `app/not-found.tsx` against the real locale bundles rather
 * than a mocked `useTranslations`, so a locale that is missing one of the new
 * keys fails here instead of shipping a raw `notFound.goMarketplace` string to
 * users.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import userEvent from "@testing-library/user-event";

import NotFound from "@/app/not-found";
import { locales, isRTL, type Locale } from "@/i18n/config";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import ar from "@/messages/ar.json";
import ptBR from "@/messages/pt-BR.json";

const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const MESSAGES: Record<Locale, Record<string, unknown>> = {
  en,
  es,
  ar,
  "pt-BR": ptBR,
} as Record<Locale, Record<string, unknown>>;

function renderAt(locale: Locale = "en") {
  // Mirrors what LocaleProvider stamps on <html>, so the RTL assertions below
  // exercise the same direction the app actually renders under.
  document.documentElement.dir = isRTL(locale) ? "rtl" : "ltr";
  document.documentElement.lang = locale;

  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <NotFound />
    </NextIntlClientProvider>
  );
}

function notFoundKey(locale: Locale, key: string): string {
  const messages = MESSAGES[locale] as { notFound: Record<string, string> };
  return messages.notFound[key];
}

beforeEach(() => {
  back.mockClear();
  document.documentElement.dir = "ltr";
});

describe("not-found recovery links", () => {
  it("offers Home, Marketplace, and Secondary", () => {
    renderAt("en");

    expect(
      screen.getByRole("link", { name: notFoundKey("en", "goHome") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: notFoundKey("en", "goMarketplace") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: notFoundKey("en", "goSecondary") })
    ).toBeInTheDocument();
  });

  it("points each link at its route", () => {
    renderAt("en");

    const href = (key: string) =>
      screen
        .getByRole("link", { name: notFoundKey("en", key) })
        .getAttribute("href");

    expect(href("goHome")).toBe("/");
    expect(href("goMarketplace")).toBe("/marketplace");
    expect(href("goSecondary")).toBe("/secondary");
  });

  it("uses client-side anchors rather than full-page navigations", () => {
    renderAt("en");

    // next/link renders a plain <a>; what matters is that none of the recovery
    // controls opted out of client navigation with a target or a reload.
    for (const link of screen.getAllByRole("link")) {
      expect(link.tagName).toBe("A");
      expect(link).not.toHaveAttribute("target");
      expect(link.getAttribute("href")).toMatch(/^\//);
    }
  });

  it("renders exactly the three recovery links", () => {
    renderAt("en");
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("still renders the title and description", () => {
    renderAt("en");

    expect(
      screen.getByRole("heading", { name: notFoundKey("en", "title") })
    ).toBeInTheDocument();
    expect(screen.getByText(notFoundKey("en", "description"))).toBeInTheDocument();
  });

  it("shows the recovery hint", () => {
    renderAt("en");
    expect(screen.getByText(notFoundKey("en", "recoveryHint"))).toBeInTheDocument();
  });

  it("keeps BackButton wired to router.back()", async () => {
    const user = userEvent.setup();
    renderAt("en");

    await user.click(screen.getByRole("button", { name: /go back/i }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("keeps the back control a button, not a link", () => {
    renderAt("en");
    // History-based recovery has no href to navigate to; regressing it into a
    // link would silently break the "back" semantics.
    expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
  });
});

describe("not-found localisation", () => {
  it.each(locales)("renders the recovery CTAs in %s", (locale) => {
    renderAt(locale as Locale);

    for (const key of ["goHome", "goMarketplace", "goSecondary"]) {
      const label = notFoundKey(locale as Locale, key);
      expect(label, `messages/${locale}.json is missing notFound.${key}`).toBeTruthy();
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it.each(locales)("has no untranslated placeholder in %s", (locale) => {
    renderAt(locale as Locale);

    // next-intl echoes the dotted key path when a message is absent.
    expect(document.body.textContent).not.toContain("notFound.");
  });

  it("translates the new keys away from the English copy in every locale", () => {
    for (const locale of locales.filter((l) => l !== "en")) {
      for (const key of ["goMarketplace", "goSecondary", "recoveryHint"]) {
        expect(
          notFoundKey(locale as Locale, key),
          `messages/${locale}.json copied the English notFound.${key}`
        ).not.toBe(notFoundKey("en", key));
      }
    }
  });
});

describe("not-found Arabic layout", () => {
  it("renders right-to-left", () => {
    renderAt("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("wraps the CTA row so four controls cannot overflow a narrow viewport", () => {
    renderAt("ar");

    const homeLink = screen.getByRole("link", { name: notFoundKey("ar", "goHome") });
    // The row is the button group; `flex-wrap` is what keeps the longer Arabic
    // labels from pushing the row past the viewport.
    const row = homeLink.closest("div.flex");
    expect(row).not.toBeNull();
    expect(row!.className).toContain("flex-wrap");
  });

  it("keeps every recovery control inside the wrapping row", () => {
    renderAt("ar");

    const homeLink = screen.getByRole("link", { name: notFoundKey("ar", "goHome") });
    const row = homeLink.closest("div.flex")!;

    expect(within(row as HTMLElement).getAllByRole("link")).toHaveLength(3);
    expect(
      within(row as HTMLElement).getByRole("button", { name: /رجوع|go back/i })
    ).toBeInTheDocument();
  });

  it("does not constrain the CTA row to a fixed width", () => {
    renderAt("ar");

    const row = screen
      .getByRole("link", { name: notFoundKey("ar", "goHome") })
      .closest("div.flex")!;
    // A fixed width (rather than the wrapping flex row) is the usual cause of
    // Arabic labels overflowing.
    expect(row.className).not.toMatch(/\bw-\[/);
  });
});
