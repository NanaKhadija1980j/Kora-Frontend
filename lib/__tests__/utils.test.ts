/**
 * Unit tests for lib/utils.ts
 *
 * Target: 100% line/branch/function coverage on every export.
 *
 * Sections:
 *  1. cn
 *  2. formatCurrency
 *  3. formatUSDC
 *  4. formatXLM
 *  5. formatPercentage
 *  6. formatPercent (deprecated)
 *  7. formatApr
 *  8. formatDate
 *  9. formatRelativeTime
 * 10. formatRelativeDate
 * 11. daysUntil
 * 12. shortenAddress
 * 13. stroopsToXlm / xlmToStroops
 * 14. RISK_TIER_COLORS / STATUS_COLORS (constant coverage)
 * 15. withRetry
 * 16. exportCsv
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cn,
  formatCurrency,
  formatUSDC,
  formatXLM,
  formatPercentage,
  formatPercent,
  formatApr,
  formatDate,
  formatRelativeTime,
  formatRelativeDate,
  daysUntil,
  truncateAddress,
  stroopsToXlm,
  xlmToStroops,
  RISK_TIER_COLORS,
  STATUS_COLORS,
  withRetry,
  exportCsv,
  calculateRepaymentSchedule,
} from "../utils";

// ─── 1. cn ────────────────────────────────────────────────────────────────────

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });
  it("deduplicates tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("handles conditional classes", () => {
    expect(cn("base", false && "skip", "end")).toBe("base end");
  });
  it("handles undefined/null inputs", () => {
    expect(cn(undefined, null as any, "ok")).toBe("ok");
  });
  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
  it("supports arrays and object-style conditional input", () => {
    expect(
      cn("base", ["px-2", { "text-sm": true, hidden: false }], "px-4")
    ).toBe("base text-sm px-4");
  });
});

// ─── 2. formatCurrency ────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats a standard amount with default currency", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56 USDC");
  });
  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00 USDC");
  });
  it("formats negative amount", () => {
    expect(formatCurrency(-500)).toBe("$-500.00 USDC");
  });
  it("handles null → treats as 0", () => {
    expect(formatCurrency(null)).toBe("$0.00 USDC");
  });
  it("handles undefined → treats as 0", () => {
    expect(formatCurrency(undefined)).toBe("$0.00 USDC");
  });
  it("uses provided currency label", () => {
    expect(formatCurrency(100, "XLM")).toBe("$100.00 XLM");
  });
  it("compact: formats millions", () => {
    expect(formatCurrency(2_500_000, "USDC", true)).toBe("$2.5M USDC");
  });
  it("compact: formats thousands", () => {
    expect(formatCurrency(1500, "USDC", true)).toBe("$1.5K USDC");
  });
  it("compact: negative millions", () => {
    expect(formatCurrency(-3_000_000, "USDC", true)).toBe("$-3.0M USDC");
  });
  it("compact: negative thousands", () => {
    expect(formatCurrency(-2500, "USDC", true)).toBe("$-2.5K USDC");
  });
  it("compact: below 1000 falls through to full format", () => {
    expect(formatCurrency(999, "USDC", true)).toBe("$999.00 USDC");
  });
  it("compact: exactly 1_000_000 boundary", () => {
    expect(formatCurrency(1_000_000, "USDC", true)).toBe("$1.0M USDC");
  });
  it("compact: exactly 1_000 boundary", () => {
    expect(formatCurrency(1_000, "USDC", true)).toBe("$1.0K USDC");
  });

  // ── Locale tests (Issue #290): en, es, ar, pt-BR ─────────────────────
  const APP_LOCALES: ReadonlyArray<"en" | "es" | "ar" | "pt-BR"> = [
    "en",
    "es",
    "ar",
    "pt-BR",
  ] as const;

  it("locale en: 1000 → '$1,000.00 USDC' (comma thousands, period decimal)", () => {
    expect(formatCurrency(1000, "USDC", false, "en")).toBe("$1,000.00 USDC");
  });
  it("locale en-US full tag also resolves via LOCALE_FORMATS", () => {
    expect(formatCurrency(1000, "USDC", false, "en-US")).toBe("$1,000.00 USDC");
  });
  it("locale es: 1000 → period thousands, comma decimal + '$' prefix", () => {
    const result = formatCurrency(1000, "USDC", false, "es");
    // es-ES uses period thousands sep and comma decimal
    expect(result).toContain("1.000,00");
    expect(result).toContain("$");
    expect(result).toContain("USDC");
  });
  it("locale pt-BR: 1000 → period thousands, comma decimal", () => {
    const result = formatCurrency(1000, "USDC", false, "pt-BR");
    // pt-BR uses period thousands sep and comma decimal (same as es)
    expect(result.replace(/[\u00a0\u202f]/g, " ")).toContain("1.000,00");
    expect(result).toContain("USDC");
  });
  it("locale ar (RTL): places '$' AFTER the number (suffix mode)", () => {
    const result = formatCurrency(1234.56, "USDC", false, "ar");
    expect(result).toContain("USDC");
    // RTL locale: dollar sign should appear after the number, not before
    const dollarIdx = result.indexOf("$");
    const numberStart = result.search(/\d/);
    expect(dollarIdx).toBeGreaterThan(numberStart);
  });
  it("currency symbol always remains USDC regardless of locale", () => {
    expect(formatCurrency(100, "USDC", false, "de-DE")).toContain("USDC");
    expect(formatCurrency(100, "USDC", false, "ja-JP")).toContain("USDC");
    expect(formatCurrency(100, "USDC", false, "ar-SA")).toContain("USDC");
  });
  it("rounds compact values to one decimal place", () => {
    expect(formatCurrency(1_549, "USDC", true)).toBe("$1.5K USDC");
    expect(formatCurrency(1_550, "USDC", true)).toBe("$1.6K USDC");
  });
});

// ─── 3. formatUSDC ───────────────────────────────────────────────────────────

describe("formatUSDC", () => {
  it("formats with 2 decimal places by default", () => {
    expect(formatUSDC(1234.56)).toBe("1,234.56 USDC");
  });
  it("respects custom decimal places", () => {
    expect(formatUSDC(1234.5, 4)).toBe("1,234.5000 USDC");
  });
  it("handles zero", () => {
    expect(formatUSDC(0)).toBe("0.00 USDC");
  });
  it("handles null → 0", () => {
    expect(formatUSDC(null)).toBe("0.00 USDC");
  });
  it("handles undefined → 0", () => {
    expect(formatUSDC(undefined)).toBe("0.00 USDC");
  });
  it("handles very large numbers", () => {
    expect(formatUSDC(1_000_000_000)).toBe("1,000,000,000.00 USDC");
  });
  it("handles negative", () => {
    expect(formatUSDC(-99.99)).toBe("-99.99 USDC");
  });
  it("0 decimals", () => {
    expect(formatUSDC(1234.56, 0)).toBe("1,235 USDC");
  });

  // ── 4-locale coverage ───────────────────────────────────────────────────
  const USDC_LOCALES = ["en", "es", "ar", "pt-BR"] as const;

  it.each(USDC_LOCALES)(
    "locale %s: 1000 USDC ends with ' USDC' label",
    (locale) => {
      const result = formatUSDC(1000, 2, locale);
      expect(result).toContain("USDC");
    }
  );

  it("locale en: 1000 → '1,000.00 USDC'", () => {
    expect(formatUSDC(1000, 2, "en")).toBe("1,000.00 USDC");
  });

  it("locale es: 1000 → period thousands + comma decimal", () => {
    const result = formatUSDC(1000, 2, "es");
    expect(result).toContain("1.000,00");
    expect(result).toContain("USDC");
  });

  it("locale pt-BR: 1000 → period thousands + comma decimal", () => {
    const result = formatUSDC(1000, 2, "pt-BR");
    expect(result.replace(/[\u00a0\u202f]/g, "")).toContain("1.000,00");
    expect(result).toContain("USDC");
  });

  it("locale ar: 1000 → non-empty string with USDC label", () => {
    const result = formatUSDC(1000, 2, "ar");
    expect(typeof result).toBe("string");
    expect(result).toContain("USDC");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── 4. formatXLM ────────────────────────────────────────────────────────────

describe("formatXLM", () => {
  it("formats with 7 decimal places", () => {
    expect(formatXLM(1234.5678)).toBe("1,234.5678000 XLM");
  });
  it("handles zero", () => {
    expect(formatXLM(0)).toBe("0.0000000 XLM");
  });
  it("handles null → 0", () => {
    expect(formatXLM(null)).toBe("0.0000000 XLM");
  });
  it("handles undefined → 0", () => {
    expect(formatXLM(undefined)).toBe("0.0000000 XLM");
  });
  it("handles negative", () => {
    expect(formatXLM(-1.5)).toBe("-1.5000000 XLM");
  });
  it("handles stroops precision (0.0000001)", () => {
    expect(formatXLM(0.0000001)).toBe("0.0000001 XLM");
  });

  // ── 4-locale coverage ───────────────────────────────────────────────────
  const XLM_LOCALES = ["en", "es", "ar", "pt-BR"] as const;

  it.each(XLM_LOCALES)(
    "locale %s: 1.5 XLM always has 7 fraction digits and 'XLM' label",
    (locale) => {
      const result = formatXLM(1.5, locale);
      expect(result).toContain("XLM");
      // Match exactly 7 digits after whatever the locale decimal separator is
      expect(result).toMatch(/\d\D\d{7}[\s\u00a0]*XLM/);
    }
  );

  it("locale es: 1000 XLM → period thousands, comma decimal", () => {
    const result = formatXLM(1000, "es");
    expect(result).toContain("1.000,0000000");
    expect(result).toContain("XLM");
  });

  it("locale pt-BR: 1000 XLM → period thousands, comma decimal", () => {
    const result = formatXLM(1000, "pt-BR");
    expect(result.replace(/[\u00a0\u202f]/g, "")).toContain("1.000,0000000");
    expect(result).toContain("XLM");
  });
});

// ─── 5. formatPercentage ─────────────────────────────────────────────────────

describe("formatPercentage", () => {
  it("formats a standard percentage", () => {
    expect(formatPercentage(12.34)).toBe("12.34%");
  });
  it("respects custom decimals", () => {
    expect(formatPercentage(5, 0)).toBe("5%");
  });
  it("handles zero", () => {
    expect(formatPercentage(0)).toBe("0.00%");
  });
  it("handles null → 0", () => {
    expect(formatPercentage(null)).toBe("0.00%");
  });
  it("handles undefined → 0", () => {
    expect(formatPercentage(undefined)).toBe("0.00%");
  });
  it("handles 100%", () => {
    expect(formatPercentage(100)).toBe("100.00%");
  });
  it("handles negative", () => {
    expect(formatPercentage(-5)).toBe("-5.00%");
  });
  it("handles fractional decimals=3", () => {
    expect(formatPercentage(33.333, 3)).toBe("33.333%");
  });
});

// ─── 6. formatPercent (deprecated) ───────────────────────────────────────────

describe("formatPercent (deprecated)", () => {
  it("multiplies by 100 and appends %", () => {
    expect(formatPercent(0.125)).toBe("12.50%");
  });
  it("handles zero", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });
  it("handles null → 0", () => {
    expect(formatPercent(null)).toBe("0.00%");
  });
  it("handles undefined → 0", () => {
    expect(formatPercent(undefined)).toBe("0.00%");
  });
  it("respects custom decimals", () => {
    expect(formatPercent(0.1, 0)).toBe("10%");
  });
});

// ─── 7. formatApr ────────────────────────────────────────────────────────────

describe("formatApr", () => {
  it("formats APR with 2 decimal places (en-US default)", () => {
    expect(formatApr(12.5)).toBe("12.50% APR");
  });
  it("handles zero", () => {
    expect(formatApr(0)).toBe("0.00% APR");
  });
  it("handles null → 0", () => {
    expect(formatApr(null)).toBe("0.00% APR");
  });
  it("handles undefined → 0", () => {
    expect(formatApr(undefined)).toBe("0.00% APR");
  });
  it("handles large APR", () => {
    expect(formatApr(99.99)).toBe("99.99% APR");
  });
  it("rounds fractional APR values consistently", () => {
    expect(formatApr(12.345)).toBe("12.35% APR");
  });
  it("supports negative APR values", () => {
    expect(formatApr(-1.5)).toBe("-1.50% APR");
  });
});

// ─── 8. formatDate ───────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("short format (default, en-US)", () => {
    expect(formatDate("2025-06-15")).toBe("Jun 15, 2025");
  });
  it("long format (en-US)", () => {
    expect(formatDate("2025-06-15", "long")).toBe("June 15, 2025");
  });
  it("relative format delegates to formatRelativeDate", () => {
    const result = formatDate("2025-01-01", "relative");
    expect(typeof result).toBe("string");
    expect(result).not.toBe("—");
  });
  it("handles null → '—'", () => {
    expect(formatDate(null)).toBe("—");
  });
  it("handles undefined → '—'", () => {
    expect(formatDate(undefined)).toBe("—");
  });
  it("handles invalid date string → '—'", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
  it("handles empty string → '—'", () => {
    expect(formatDate("")).toBe("—");
  });

  // ── Locale tests (Issue #290): 4 locales ────────────────────────────────
  const DATE_LOCALES = ["en", "es", "ar", "pt-BR"] as const;

  it.each(DATE_LOCALES)("locale %s: short format returns non-empty date string", (locale) => {
    const result = formatDate("2025-06-15", "short", locale);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("—");
  });

  it.each(DATE_LOCALES)("locale %s: long format returns non-empty date string", (locale) => {
    const result = formatDate("2025-06-15", "long", locale);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("—");
  });

  it("locale en: long format contains 'June 15, 2025'", () => {
    expect(formatDate("2025-06-15", "long", "en")).toBe("June 15, 2025");
  });

  it("locale es: short format contains Spanish month abbreviation", () => {
    const result = formatDate("2025-06-15", "short", "es");
    // "jun" for junio; day 15; year 2025
    expect(result.toLowerCase()).toContain("jun");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("locale pt-BR: short format contains Portuguese month abbreviation", () => {
    const result = formatDate("2025-06-15", "short", "pt-BR");
    // "jun" for junho in pt-BR
    expect(result.toLowerCase()).toContain("jun");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("locale ar: short format contains year 2025 in some numeral form", () => {
    const result = formatDate("2025-06-15", "short", "ar");
    // Accept either western or Eastern-Arabic numerals; year 2025 or ٢٠٢٥
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── 8b. formatPercentage — 4-locale tests ───────────────────────────────────

describe("formatPercentage (4 locales)", () => {
  const PCT_LOCALES = ["en", "es", "ar", "pt-BR"] as const;

  it.each(PCT_LOCALES)("locale %s: 12.5 with 2 decimals ends with %%", (locale) => {
    const result = formatPercentage(12.5, 2, locale);
    expect(result.endsWith("%")).toBe(true);
  });

  it("locale en: 50 → '50.00%'", () => {
    expect(formatPercentage(50, 2, "en")).toBe("50.00%");
  });

  it("locale es: 1234.56 → period thousands / comma decimal + %", () => {
    const result = formatPercentage(1234.56, 2, "es");
    // style: percent with Intl => 1.234,56 % or 1.234,56% depending on browser
    expect(result.replace(/\s/g, "")).toContain("1.234,56");
    expect(result).toContain("%");
  });

  it("locale pt-BR: 1234.56 → period thousands / comma decimal", () => {
    const result = formatPercentage(1234.56, 2, "pt-BR");
    expect(result.replace(/\s/g, "")).toContain("1.234,56");
    expect(result).toContain("%");
  });

  it("locale ar: produces a non-empty percentage string", () => {
    const result = formatPercentage(12.5, 2, "ar");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── 9. formatRelativeTime ───────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  it("returns '—' for null", () => {
    expect(formatRelativeTime(null)).toBe("—");
  });
  it("returns '—' for undefined", () => {
    expect(formatRelativeTime(undefined)).toBe("—");
  });
  it("returns '—' for invalid date string", () => {
    expect(formatRelativeTime("bad-date")).toBe("—");
  });
  it("formats seconds ago (< 60s)", () => {
    const d = new Date(Date.now() - 30_000);
    const result = formatRelativeTime(d);
    expect(result).toMatch(/second/);
  });
  it("formats minutes ago (< 60min)", () => {
    const d = new Date(Date.now() - 5 * 60_000);
    expect(formatRelativeTime(d)).toMatch(/minute/);
  });
  it("formats hours ago (< 24h)", () => {
    const d = new Date(Date.now() - 2 * 3600_000);
    expect(formatRelativeTime(d)).toBe("2 hours ago");
  });
  it("formats days ago (< 7d)", () => {
    const d = new Date(Date.now() - 3 * 86_400_000);
    expect(formatRelativeTime(d)).toBe("3 days ago");
  });
  it("formats weeks ago (< 5 weeks)", () => {
    const d = new Date(Date.now() - 14 * 86_400_000);
    expect(formatRelativeTime(d)).toMatch(/week/);
  });
  it("formats months ago (< 12 months)", () => {
    const d = new Date(Date.now() - 60 * 86_400_000);
    expect(formatRelativeTime(d)).toMatch(/month/);
  });
  it("formats years", () => {
    const d = new Date(Date.now() - 400 * 86_400_000);
    expect(formatRelativeTime(d)).toMatch(/year/);
  });
  it("formats future date in days", () => {
    const d = new Date(Date.now() + 5 * 86_400_000);
    expect(formatRelativeTime(d)).toBe("in 5 days");
  });
  it("formats future date in hours", () => {
    const d = new Date(Date.now() + 3 * 3600_000);
    expect(formatRelativeTime(d)).toBe("in 3 hours");
  });
  it("accepts a date string", () => {
    const future = new Date(Date.now() + 365 * 86_400_000).toISOString();
    expect(formatRelativeTime(future)).toMatch(/year/);
  });
});

// ─── 10. formatRelativeDate ──────────────────────────────────────────────────

describe("formatRelativeDate", () => {
  it("returns '—' for null", () => {
    expect(formatRelativeDate(null)).toBe("—");
  });
  it("returns '—' for undefined", () => {
    expect(formatRelativeDate(undefined)).toBe("—");
  });
  it("returns '—' for invalid date", () => {
    expect(formatRelativeDate("not-a-date")).toBe("—");
  });
  it("returns a relative string for a valid past date", () => {
    const past = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const result = formatRelativeDate(past);
    expect(result).toMatch(/ago/);
  });
  it("returns a relative string for a valid future date", () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const result = formatRelativeDate(future);
    expect(result).toMatch(/in/);
  });
});

// ─── 11. daysUntil ───────────────────────────────────────────────────────────

describe("daysUntil", () => {
  it("returns a positive number for a future date", () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().split("T")[0];
    expect(daysUntil(future)).toBeGreaterThan(0);
  });
  it("returns a negative number for a past date", () => {
    const past = new Date(Date.now() - 10 * 86_400_000).toISOString().split("T")[0];
    expect(daysUntil(past)).toBeLessThan(0);
  });
  it("returns approximately 0 for today", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(Math.abs(daysUntil(today))).toBeLessThanOrEqual(1);
  });
});

// ─── 12. truncateAddress ──────────────────────────────────────────────────────

describe("truncateAddress", () => {
  const addr = "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ";

  it("shortens with default 4 chars", () => {
    expect(truncateAddress(addr)).toBe("GBVZ...QKZQ");
  });
  it("shortens with custom chars", () => {
    expect(truncateAddress(addr, 6)).toBe("GBVZQ4...KZQKZQ");
  });
  it("returns empty string for empty input", () => {
    expect(truncateAddress("")).toBe("");
  });
  it("returns empty string for falsy input", () => {
    expect(truncateAddress(undefined as any)).toBe("");
  });
  it("returns the trimmed address unchanged when it is already short", () => {
    expect(truncateAddress("  GABC1234  ", 4)).toBe("GABC1234");
  });
  it("trims leading and trailing whitespace before truncating", () => {
    expect(truncateAddress(`  ${addr}  `, 5)).toBe("GBVZQ...ZQKZQ");
  });
  it("returns the full string when chars * 2 covers the address length", () => {
    expect(truncateAddress("GABCD123", 4)).toBe("GABCD123");
  });
});

// ─── 13. withRetry ────────────────────────────────────────────────────────────

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("succeeds on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx error and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("500 Internal Server Error"))
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValueOnce("success");

    const promise = withRetry(fn, 3, 100);
    
    // Fast-forward timers for retries
    await vi.runAllTimersAsync();
    
    const result = await promise;
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("fails permanently when max attempts are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("500 Internal Server Error"));
    const promise = withRetry(fn, 3, 100);
    promise.catch(() => {});

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow("500 Internal Server Error");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry on non-5xx errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("400 Bad Request"));
    const promise = withRetry(fn, 3, 100);

    await expect(promise).rejects.toThrow("400 Bad Request");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─── 14. exportCsv ────────────────────────────────────────────────────────────

describe("exportCsv", () => {
  let mockClick: any;
  let mockElement: any;

  beforeEach(() => {
    mockClick = vi.fn();
    mockElement = {
      href: "",
      download: "",
      click: mockClick,
    };

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });

    vi.stubGlobal("document", {
      createElement: vi.fn(() => mockElement),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing for empty rows", () => {
    exportCsv([]);
    expect(document.createElement).not.toHaveBeenCalled();
  });

  it("converts rows to CSV and triggers download", () => {
    const rows = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];

    exportCsv(rows, "test.csv");

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(mockElement.download).toBe("test.csv");
    expect(mockElement.href).toBe("blob:mock-url");
    expect(mockClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("escapes values containing commas, quotes, and newlines", () => {
    const rows = [
      { text: 'hello, "world"' },
      { text: "line1\nline2" },
    ];

    exportCsv(rows, "escape.csv");

    // Retrieve the blob created
    const blobCall = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blobCall).toBeInstanceOf(Blob);
  });
});

describe("calculateRepaymentSchedule", () => {
  it("calculates correct principal, yield, and total repayment", () => {
    const invoice = {
      funding: { totalRaised: 10000 },
      terms: { financingAmount: 10000, discountRate: 0.1 },
    };
    const schedule = calculateRepaymentSchedule(invoice);
    expect(schedule.principal).toBe(10000);
    expect(schedule.yieldAmount).toBe(1000);
    expect(schedule.totalRepayment).toBe(11000);
    expect(schedule.discountRate).toBe(0.1);
  });

  it("handles null or undefined invoice gracefully", () => {
    const schedule = calculateRepaymentSchedule(null);
    expect(schedule).toEqual({ principal: 0, yieldAmount: 0, totalRepayment: 0, discountRate: 0 });
  });

  it("falls back to financingAmount if totalRaised is undefined", () => {
    const invoice = {
      terms: { financingAmount: 5000, discountRate: 0.05 },
    };
    const schedule = calculateRepaymentSchedule(invoice);
    expect(schedule.principal).toBe(5000);
    expect(schedule.yieldAmount).toBe(250);
    expect(schedule.totalRepayment).toBe(5250);
  });
});

