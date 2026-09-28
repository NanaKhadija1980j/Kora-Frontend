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
import {
  LOCALE_FORMATS,
  getIntlTag,
  getLocaleFormatConfig,
} from "@/lib/validations/locales";
import type { Locale } from "../config";

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

// ─── Locale formatting configuration (LOCALE_FORMATS) ─────────────────────────

describe("LOCALE_FORMATS — locale-aware number/currency/date configuration", () => {
  const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "es", "ar", "pt-BR"];

  it.each(SUPPORTED_LOCALES)(
    "locale %s defines a complete LocaleFormatConfig with intlTag, separators, and examples",
    (locale) => {
      const cfg = LOCALE_FORMATS[locale];
      expect(cfg).toBeDefined();
      expect(typeof cfg.intlTag).toBe("string");
      expect(cfg.intlTag.length).toBeGreaterThan(1);
      expect(typeof cfg.thousandsSep).toBe("string");
      expect(typeof cfg.decimalSep).toBe("string");
      expect(["MDY", "DMY", "YMD"]).toContain(cfg.dateOrder);
      expect(typeof cfg.rtl).toBe("boolean");
      expect(typeof cfg.examples.currency).toBe("string");
      expect(typeof cfg.examples.dateShort).toBe("string");
      expect(typeof cfg.examples.percentage).toBe("string");
    }
  );

  it("en uses comma thousands, period decimal, MDY date order, LTR", () => {
    const cfg = LOCALE_FORMATS.en;
    expect(cfg.intlTag).toBe("en-US");
    expect(cfg.thousandsSep).toBe(",");
    expect(cfg.decimalSep).toBe(".");
    expect(cfg.dateOrder).toBe("MDY");
    expect(cfg.rtl).toBe(false);
    expect(cfg.numberingSystem).toBe("latn");
  });

  it("es uses period thousands, comma decimal, DMY date order, LTR", () => {
    const cfg = LOCALE_FORMATS.es;
    expect(cfg.intlTag).toBe("es-ES");
    expect(cfg.thousandsSep).toBe(".");
    expect(cfg.decimalSep).toBe(",");
    expect(cfg.dateOrder).toBe("DMY");
    expect(cfg.rtl).toBe(false);
  });

  it("pt-BR uses period thousands, comma decimal, DMY date order, LTR", () => {
    const cfg = LOCALE_FORMATS["pt-BR"];
    expect(cfg.intlTag).toBe("pt-BR");
    expect(cfg.thousandsSep).toBe(".");
    expect(cfg.decimalSep).toBe(",");
    expect(cfg.dateOrder).toBe("DMY");
    expect(cfg.rtl).toBe(false);
  });

  it("ar is RTL with Arabic-Indic numbering system and DMY date order", () => {
    const cfg = LOCALE_FORMATS.ar;
    expect(cfg.intlTag).toBe("ar-SA");
    expect(cfg.rtl).toBe(true);
    expect(cfg.dateOrder).toBe("DMY");
    expect(cfg.numberingSystem).toBe("arab");
  });
});

describe("getIntlTag — resolve canonical Intl tag for app locale", () => {
  it("returns en-US for 'en'", () => {
    expect(getIntlTag("en")).toBe("en-US");
  });
  it("returns es-ES for 'es'", () => {
    expect(getIntlTag("es")).toBe("es-ES");
  });
  it("returns ar-SA for 'ar'", () => {
    expect(getIntlTag("ar")).toBe("ar-SA");
  });
  it("returns pt-BR for 'pt-BR' (no extra regional transform needed)", () => {
    expect(getIntlTag("pt-BR")).toBe("pt-BR");
  });
});

describe("getLocaleFormatConfig — look up config by short tag or full Intl tag", () => {
  it("resolves short app locale codes", () => {
    expect(getLocaleFormatConfig("en").intlTag).toBe("en-US");
    expect(getLocaleFormatConfig("es").intlTag).toBe("es-ES");
    expect(getLocaleFormatConfig("ar").rtl).toBe(true);
    expect(getLocaleFormatConfig("pt-BR").decimalSep).toBe(",");
  });

  it("resolves full Intl tags back to app locale entry", () => {
    expect(getLocaleFormatConfig("en-US").intlTag).toBe("en-US");
    expect(getLocaleFormatConfig("es-ES").intlTag).toBe("es-ES");
    expect(getLocaleFormatConfig("ar-SA").rtl).toBe(true);
  });

  it("falls back to English config for unknown locale codes", () => {
    const fallback = getLocaleFormatConfig("zh-CN");
    expect(fallback.intlTag).toBe("en-US");
    expect(fallback.rtl).toBe(false);
  });
});
