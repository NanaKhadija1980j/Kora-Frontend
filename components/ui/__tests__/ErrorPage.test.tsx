/**
 * Shared route error page — Issue #680.
 *
 * `app/analytics/error.tsx` and `app/dashboard/investor/error.tsx` both render
 * this component, so covering it here covers both routes. Rendered against the
 * real locale bundles, so a locale missing the new key fails the suite rather
 * than shipping a raw `error.goMarketplace` to users.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ErrorPage } from "@/components/ui/ErrorPage";
import { locales, type Locale } from "@/i18n/config";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import ar from "@/messages/ar.json";
import ptBR from "@/messages/pt-BR.json";

const reportClientError = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    reportClientError: (...args: unknown[]) => reportClientError(...args),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const MESSAGES = { en, es, ar, "pt-BR": ptBR } as unknown as Record<
  Locale,
  Record<string, unknown>
>;

function errorKey(locale: Locale, key: string): string {
  return (MESSAGES[locale] as { error: Record<string, string> }).error[key];
}

let queryClient: QueryClient;
let refetchSpy: ReturnType<typeof vi.spyOn>;

function renderPage(
  opts: { locale?: Locale; error?: Error & { digest?: string }; reset?: () => void } = {}
) {
  const locale = opts.locale ?? "en";
  const error = opts.error ?? Object.assign(new Error("boom"), { digest: "d1" });
  const reset = opts.reset ?? vi.fn();

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        <ErrorPage error={error} reset={reset} />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );

  return { ...utils, reset, error };
}

beforeEach(() => {
  reportClientError.mockClear();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  refetchSpy = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue(undefined);
});

describe("ErrorPage — recovery actions", () => {
  it("offers Retry, Marketplace, and Home", () => {
    renderPage();

    expect(
      screen.getByRole("button", { name: new RegExp(errorKey("en", "tryAgain"), "i") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: errorKey("en", "goMarketplace") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: errorKey("en", "goHome") })
    ).toBeInTheDocument();
  });

  it("points the recovery links at their routes", () => {
    renderPage();

    expect(
      screen.getByRole("link", { name: errorKey("en", "goMarketplace") })
    ).toHaveAttribute("href", "/marketplace");
    expect(screen.getByRole("link", { name: errorKey("en", "goHome") })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("renders exactly the two recovery links", () => {
    renderPage();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("keeps Retry a button rather than a link", () => {
    renderPage();
    // Retry re-runs the boundary in place; it has no destination.
    expect(
      screen.getByRole("button", { name: new RegExp(errorKey("en", "tryAgain"), "i") })
    ).toBeInTheDocument();
  });
});

describe("ErrorPage — retry", () => {
  it("calls reset()", async () => {
    const user = userEvent.setup();
    const { reset } = renderPage();

    await user.click(
      screen.getByRole("button", { name: new RegExp(errorKey("en", "tryAgain"), "i") })
    );

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("refetches the active queries", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: new RegExp(errorKey("en", "tryAgain"), "i") })
    );

    // Without this, resetting the boundary re-renders against the same rejected
    // query and the page fails again immediately.
    expect(refetchSpy).toHaveBeenCalledWith({ type: "active" });
  });

  it("refetches before handing control back to the boundary", async () => {
    const order: string[] = [];
    refetchSpy.mockImplementation(async () => {
      order.push("refetch");
      return undefined;
    });
    const reset = vi.fn(() => {
      order.push("reset");
    });

    const user = userEvent.setup();
    renderPage({ reset });

    await user.click(
      screen.getByRole("button", { name: new RegExp(errorKey("en", "tryAgain"), "i") })
    );

    expect(order).toEqual(["refetch", "reset"]);
  });

  it("does not retry until the button is pressed", () => {
    renderPage();

    expect(refetchSpy).not.toHaveBeenCalled();
  });
});

describe("ErrorPage — accessibility", () => {
  it("announces the failure through role=alert", () => {
    renderPage();

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(within(alert).getByRole("heading")).toHaveTextContent(errorKey("en", "title"));
  });

  it("announces assertively", () => {
    renderPage();
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("keeps the recovery actions out of the alert region", () => {
    renderPage();

    // Screen readers should hear the failure, not a re-read of every button.
    const alert = screen.getByRole("alert");
    expect(within(alert).queryAllByRole("link")).toHaveLength(0);
    expect(within(alert).queryAllByRole("button")).toHaveLength(0);
  });
});

describe("ErrorPage — reporting", () => {
  it("reports the error once with its digest", () => {
    const error = Object.assign(new Error("kaboom"), { digest: "abc123" });
    renderPage({ error });

    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError.mock.calls[0][0]).toBe(error);
    expect(reportClientError.mock.calls[0][1]).toMatchObject({
      boundary: "ErrorPage",
      digest: "abc123",
    });
  });

  it("still renders for an error carrying no digest", () => {
    renderPage({ error: new Error("no digest") });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(reportClientError.mock.calls[0][1]).toMatchObject({ digest: undefined });
  });

  it("renders for an error with an empty message", () => {
    renderPage({ error: new Error("") });

    expect(
      screen.getByRole("heading", { name: errorKey("en", "title") })
    ).toBeInTheDocument();
  });
});

describe("ErrorPage — localisation", () => {
  it.each(locales)("renders every recovery action in %s", (locale) => {
    renderPage({ locale: locale as Locale });

    for (const key of ["goMarketplace", "goHome"]) {
      const label = errorKey(locale as Locale, key);
      expect(label, `messages/${locale}.json is missing error.${key}`).toBeTruthy();
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }

    expect(
      screen.getByRole("heading", { name: errorKey(locale as Locale, "title") })
    ).toBeInTheDocument();
  });

  it.each(locales)("leaves no untranslated placeholder in %s", (locale) => {
    renderPage({ locale: locale as Locale });

    // next-intl echoes the dotted key path when a message is missing.
    expect(document.body.textContent).not.toContain("error.");
  });

  it("translates the marketplace CTA away from English in every locale", () => {
    for (const locale of locales.filter((l) => l !== "en")) {
      expect(
        errorKey(locale as Locale, "goMarketplace"),
        `messages/${locale}.json copied the English error.goMarketplace`
      ).not.toBe(errorKey("en", "goMarketplace"));
    }
  });
});
