import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_MAX_AGE,
  detectBrowserLocale,
  detectLocaleFromAcceptLanguage,
  getCookieLocale,
  getLocaleCookieOptions,
  parseLocale,
  resolveLocale,
  resolveLocaleFromRequest,
  setCookieLocale,
} from "../locale";

describe("parseLocale", () => {
  it("accepts supported locale codes", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("es")).toBe("es");
  });

  it("normalises region subtags", () => {
    expect(parseLocale("es-MX")).toBe("es");
    expect(parseLocale("en-US")).toBe("en");
  });

  it("returns null for unsupported locales", () => {
    expect(parseLocale("fr")).toBeNull();
    expect(parseLocale("")).toBeNull();
    expect(parseLocale(null)).toBeNull();
  });
});

describe("detectLocaleFromAcceptLanguage", () => {
  it("picks the first supported language", () => {
    expect(detectLocaleFromAcceptLanguage("fr-FR, es;q=0.9, en;q=0.8")).toBe("es");
  });

  it("falls back to default when no match", () => {
    expect(detectLocaleFromAcceptLanguage("fr-FR, de-DE")).toBe("en");
  });
});

describe("resolveLocaleFromRequest", () => {
  it("prefers cookie over Accept-Language", () => {
    expect(resolveLocaleFromRequest("es", "en-US,en;q=0.9")).toBe("es");
  });

  it("uses Accept-Language when cookie is missing", () => {
    expect(resolveLocaleFromRequest(undefined, "es-ES,es;q=0.9")).toBe("es");
  });
});

describe("getLocaleCookieOptions", () => {
  it("uses 30-day expiry and SameSite=Lax", () => {
    const options = getLocaleCookieOptions(false);
    expect(options.maxAge).toBe(LOCALE_COOKIE_MAX_AGE);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("sets Secure in production", () => {
    expect(getLocaleCookieOptions(true).secure).toBe(true);
    expect(getLocaleCookieOptions(false).secure).toBe(false);
  });
});

describe("cookie persistence (client)", () => {
  beforeEach(() => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes and reads the kora-locale cookie", () => {
    setCookieLocale("es");
    expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=es`);
    expect(getCookieLocale()).toBe("es");
  });

  it("resolveLocale prefers cookie over browser language", () => {
    setCookieLocale("es");
    vi.stubGlobal("navigator", { language: "en-US", languages: ["en-US"] });
    expect(resolveLocale()).toBe("es");
  });

  it("resolveLocale falls back to browser language without cookie", () => {
    vi.stubGlobal("navigator", { language: "es-ES", languages: ["es-ES"] });
    expect(resolveLocale()).toBe("es");
  });
});

describe("detectBrowserLocale", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects Spanish from navigator.languages", () => {
    vi.stubGlobal("navigator", { language: "en-US", languages: ["fr-FR", "es-ES"] });
    expect(detectBrowserLocale()).toBe("es");
  });
});
