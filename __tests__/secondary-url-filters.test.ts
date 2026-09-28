/**
 * Unit tests for secondary market URL filter persistence (#643).
 */

import { describe, it, expect } from "vitest";
import {
  parseTenorParam,
  parseYieldParam,
  parseTextParam,
  parseSecondaryFiltersFromSearchParams,
  secondaryFiltersToQueryString,
  DEFAULT_SECONDARY_FILTERS,
} from "@/lib/secondaryUrlFilters";

describe("secondaryUrlFilters (#643)", () => {
  it("falls back safely for invalid tenor and yield params", () => {
    expect(parseTenorParam("bogus")).toBe("all");
    expect(parseTenorParam("nope-90")).toBe("all");
    expect(parseYieldParam("999")).toBe("0");
    expect(parseYieldParam("abc")).toBe("0");
  });

  it("preserves valid tenor and yield params", () => {
    expect(parseTenorParam("0-30")).toBe("0-30");
    expect(parseTenorParam("90+")).toBe("90+");
    expect(parseYieldParam("10")).toBe("10");
    expect(parseYieldParam("15")).toBe("15");
  });

  it("sanitizes free-text params and strips control characters", () => {
    expect(parseTextParam("hello\u0000world")).toBe("helloworld");
    expect(parseTextParam(null)).toBe("");
  });

  it("hydrates filters from a shared URL search string", () => {
    const params = new URLSearchParams(
      "q=tech&tenor=31-60&yield=10&seller=GSELLER111&highlight=pos_101"
    );
    expect(parseSecondaryFiltersFromSearchParams(params)).toEqual({
      q: "tech",
      tenor: "31-60",
      yield: "10",
      seller: "GSELLER111",
      highlight: "pos_101",
    });
  });

  it("normalizes invalid params when hydrating from URL", () => {
    const params = new URLSearchParams("tenor=nope&yield=999&q=ok");
    expect(parseSecondaryFiltersFromSearchParams(params)).toEqual({
      ...DEFAULT_SECONDARY_FILTERS,
      q: "ok",
    });
  });

  it("omits defaults from the query string so reset clears URL params", () => {
    expect(secondaryFiltersToQueryString(DEFAULT_SECONDARY_FILTERS)).toBe("");
    expect(
      secondaryFiltersToQueryString({
        q: "agri",
        tenor: "0-30",
        yield: "5",
        seller: "GABC",
        highlight: "",
      })
    ).toBe("q=agri&tenor=0-30&yield=5&seller=GABC");
  });

  it("drops invalid select values when serializing to the URL", () => {
    expect(
      secondaryFiltersToQueryString({
        q: "",
        tenor: "invalid",
        yield: "bad",
        seller: "",
        highlight: "",
      })
    ).toBe("");
  });
});
