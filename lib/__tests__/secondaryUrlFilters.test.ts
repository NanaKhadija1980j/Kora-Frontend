/**
 * Unit tests for `lib/secondaryUrlFilters` — Issue #806.
 *
 * Colocated with module under `lib/__tests__/` per CONTRIBUTING.md.
 * Covers whitelist tenor/yield and query sanitization:
 * - parseTenorParam whitelist enforcement against valid and invalid inputs.
 * - parseYieldParam whitelist enforcement against valid and invalid inputs.
 * - parseTextParam sanitization: stripping non-ASCII/control characters and clamping to 256 chars.
 * - parseSecondaryFiltersFromSearchParams hydration with defaults and sanitization.
 * - secondaryFiltersToQueryString serialization omitting defaults and sanitizing values.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_SECONDARY_FILTERS,
  SECONDARY_PARAM,
  parseSecondaryFiltersFromSearchParams,
  parseTenorParam,
  parseTextParam,
  parseYieldParam,
  secondaryFiltersToQueryString,
  type SecondaryUrlFilters,
} from "@/lib/secondaryUrlFilters";

describe("lib/secondaryUrlFilters - Constants", () => {
  it("defines standard query parameter keys", () => {
    expect(SECONDARY_PARAM).toEqual({
      SEARCH: "q",
      TENOR: "tenor",
      YIELD: "yield",
      SELLER: "seller",
      HIGHLIGHT: "highlight",
    });
  });

  it("defines expected default filter values", () => {
    expect(DEFAULT_SECONDARY_FILTERS).toEqual({
      q: "",
      tenor: "all",
      yield: "0",
      seller: "",
      highlight: "",
    });
  });
});

describe("lib/secondaryUrlFilters - Tenor Whitelist (parseTenorParam)", () => {
  it.each(["all", "0-30", "31-60", "61-90", "90+"])(
    "accepts whitelisted tenor value: %s",
    (tenor) => {
      expect(parseTenorParam(tenor)).toBe(tenor);
    }
  );

  it.each([
    ["empty string", ""],
    ["whitespace string", "   "],
    ["null", null],
    ["undefined", undefined],
    ["invalid number", "30"],
    ["invalid range", "0-60"],
    ["unknown label", "long-term"],
    ["arbitrary text", "malicious_input"],
    ["SQL injection pattern", "' OR 1=1 --"],
    ["HTML script injection", "<script>alert(1)</script>"],
  ])("falls back to 'all' for %s", (_desc, raw) => {
    expect(parseTenorParam(raw)).toBe(DEFAULT_SECONDARY_FILTERS.tenor);
  });

  it("sanitizes non-printable characters before checking whitelist", () => {
    // Contains null byte or ANSI escape characters
    expect(parseTenorParam("0-30\x00")).toBe("0-30");
    expect(parseTenorParam("\x1b[31mall")).toBe("all");
    expect(parseTenorParam("0-30\r\n")).toBe("0-30");
  });
});

describe("lib/secondaryUrlFilters - Yield Whitelist (parseYieldParam)", () => {
  it.each(["0", "5", "10", "15"])(
    "accepts whitelisted yield value: %s",
    (yieldVal) => {
      expect(parseYieldParam(yieldVal)).toBe(yieldVal);
    }
  );

  it.each([
    ["empty string", ""],
    ["whitespace string", "   "],
    ["null", null],
    ["undefined", undefined],
    ["non-whitelisted tier", "8"],
    ["higher tier", "20"],
    ["negative tier", "-5"],
    ["decimal tier", "5.5"],
    ["arbitrary string", "high_yield"],
    ["XSS payload", "\"><img src=x onerror=alert(1)>"],
  ])("falls back to '0' for %s", (_desc, raw) => {
    expect(parseYieldParam(raw)).toBe(DEFAULT_SECONDARY_FILTERS.yield);
  });

  it("sanitizes non-printable characters before checking whitelist", () => {
    expect(parseYieldParam("5\x00")).toBe("5");
    expect(parseYieldParam("\x0710")).toBe("10");
  });
});

describe("lib/secondaryUrlFilters - Query Text Sanitization (parseTextParam)", () => {
  it("returns empty string for null, undefined, or empty values", () => {
    expect(parseTextParam(null)).toBe("");
    expect(parseTextParam(undefined)).toBe("");
    expect(parseTextParam("")).toBe("");
  });

  it("preserves valid printable ASCII characters (0x20 - 0x7E)", () => {
    const validText = "Invoice #1234 - Medical Supplies (Batch A)! $100 & 50%";
    expect(parseTextParam(validText)).toBe(validText);
  });

  it("strips non-printable ASCII and control characters", () => {
    const dirty = "hello\x00\x01\x08world\x1b\x7f!";
    expect(parseTextParam(dirty)).toBe("helloworld!");
  });

  it("strips non-ASCII unicode characters, emojis, and zero-width spaces", () => {
    const unicodeInput = "Sponsor 🚀 \u200BCorporation \u00E9\u00F1";
    expect(parseTextParam(unicodeInput)).toBe("Sponsor  Corporation ");
  });

  it("truncates strings longer than 256 characters to 256 characters", () => {
    const longInput = "a".repeat(300);
    const result = parseTextParam(longInput);
    expect(result.length).toBe(256);
    expect(result).toBe("a".repeat(256));
  });

  it("strips non-ASCII before slicing to 256 characters", () => {
    // 10 non-ASCII chars followed by 300 'b's
    const input = "\uD83D\uDE80".repeat(5) + "b".repeat(300);
    const result = parseTextParam(input);
    expect(result.length).toBe(256);
    expect(result).toBe("b".repeat(256));
  });
});

describe("lib/secondaryUrlFilters - parseSecondaryFiltersFromSearchParams", () => {
  it("returns default filters when URLSearchParams is empty", () => {
    const params = new URLSearchParams();
    expect(parseSecondaryFiltersFromSearchParams(params)).toEqual(
      DEFAULT_SECONDARY_FILTERS
    );
  });

  it("hydrates filters correctly from valid URLSearchParams", () => {
    const params = new URLSearchParams({
      q: "logistics",
      tenor: "31-60",
      yield: "10",
      seller: "GBQXFQ2PVCFP2LOJ3XPMBLM5R2LSCVJKGHGXAWWVQCLDWKZVKKPFDANJ",
      highlight: "pos-42",
    });

    expect(parseSecondaryFiltersFromSearchParams(params)).toEqual({
      q: "logistics",
      tenor: "31-60",
      yield: "10",
      seller: "GBQXFQ2PVCFP2LOJ3XPMBLM5R2LSCVJKGHGXAWWVQCLDWKZVKKPFDANJ",
      highlight: "pos-42",
    });
  });

  it("sanitizes text fields and enforces whitelists on invalid values", () => {
    const params = new URLSearchParams({
      q: "invoice\x00tag\u200B",
      tenor: "invalid-range",
      yield: "99",
      seller: "seller\x1b123",
      highlight: "hl\x0799",
    });

    expect(parseSecondaryFiltersFromSearchParams(params)).toEqual({
      q: "invoicetag",
      tenor: "all",
      yield: "0",
      seller: "seller123",
      highlight: "hl99",
    });
  });
});

describe("lib/secondaryUrlFilters - secondaryFiltersToQueryString", () => {
  it("returns empty string when all filters match defaults", () => {
    expect(secondaryFiltersToQueryString(DEFAULT_SECONDARY_FILTERS)).toBe("");
  });

  it("omits default values when only some parameters are set", () => {
    const filters: SecondaryUrlFilters = {
      ...DEFAULT_SECONDARY_FILTERS,
      q: "pharma",
    };
    expect(secondaryFiltersToQueryString(filters)).toBe("q=pharma");
  });

  it("encodes non-default tenor and yield correctly", () => {
    const filters: SecondaryUrlFilters = {
      ...DEFAULT_SECONDARY_FILTERS,
      tenor: "0-30",
      yield: "15",
    };
    expect(secondaryFiltersToQueryString(filters)).toBe("tenor=0-30&yield=15");
  });

  it("serializes all non-default fields into valid query string", () => {
    const filters: SecondaryUrlFilters = {
      q: "medical supplies",
      tenor: "61-90",
      yield: "10",
      seller: "GBQXFQ2P",
      highlight: "pos-101",
    };

    const qs = secondaryFiltersToQueryString(filters);
    const parsed = new URLSearchParams(qs);

    expect(parsed.get("q")).toBe("medical supplies");
    expect(parsed.get("tenor")).toBe("61-90");
    expect(parsed.get("yield")).toBe("10");
    expect(parsed.get("seller")).toBe("GBQXFQ2P");
    expect(parsed.get("highlight")).toBe("pos-101");
  });

  it("sanitizes text and falls back to defaults (which are omitted) for invalid inputs", () => {
    const filters: SecondaryUrlFilters = {
      q: "clean\x00query",
      tenor: "bad-tenor", // Normalizes to "all", omitted
      yield: "bad-yield", // Normalizes to "0", omitted
      seller: "seller\x07key",
      highlight: "",
    };

    const qs = secondaryFiltersToQueryString(filters);
    const parsed = new URLSearchParams(qs);

    expect(parsed.get("q")).toBe("cleanquery");
    expect(parsed.get("seller")).toBe("sellerkey");
    expect(parsed.has("tenor")).toBe(false);
    expect(parsed.has("yield")).toBe(false);
    expect(parsed.has("highlight")).toBe(false);
  });
});
