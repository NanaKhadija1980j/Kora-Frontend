/**
 * Benchmark configuration tests (issue #603).
 */

import { describe, it, expect } from "vitest";
import {
  BENCHMARK_DISCLOSURE,
  buildBenchmarkConfig,
  compareToBenchmarks,
  parseBenchmarkApr,
} from "@/lib/benchmarks";

describe("parseBenchmarkApr", () => {
  it("parses a plain number", () => {
    expect(parseBenchmarkApr("4.5")).toBe(4.5);
    expect(parseBenchmarkApr("0")).toBe(0);
  });

  it("tolerates a trailing percent sign", () => {
    // The most likely way someone writes this by hand.
    expect(parseBenchmarkApr("4.5%")).toBe(4.5);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseBenchmarkApr("  7 ")).toBe(7);
  });

  it("returns null for absent or empty values", () => {
    expect(parseBenchmarkApr(undefined)).toBeNull();
    expect(parseBenchmarkApr(null)).toBeNull();
    expect(parseBenchmarkApr("")).toBeNull();
    expect(parseBenchmarkApr("   ")).toBeNull();
  });

  it("returns null for non-numeric values instead of throwing", () => {
    // A bad env var must not take the analytics page down.
    expect(parseBenchmarkApr("abc")).toBeNull();
    expect(parseBenchmarkApr("NaN")).toBeNull();
  });

  it("rejects out-of-range rates", () => {
    // Outside 0–100 is a typo or a unit mix-up (0.045 vs 4.5 vs 450).
    expect(parseBenchmarkApr("-1")).toBeNull();
    expect(parseBenchmarkApr("101")).toBeNull();
    expect(parseBenchmarkApr("Infinity")).toBeNull();
  });

  it("accepts the range boundaries", () => {
    expect(parseBenchmarkApr("0")).toBe(0);
    expect(parseBenchmarkApr("100")).toBe(100);
  });
});

describe("buildBenchmarkConfig", () => {
  it("is disabled when nothing is configured", () => {
    const config = buildBenchmarkConfig({});
    expect(config.enabled).toBe(false);
    expect(config.benchmarks).toEqual([]);
  });

  it("includes only the benchmarks that parse", () => {
    const config = buildBenchmarkConfig({ riskFree: "4.5", basket: "not-a-number" });
    expect(config.enabled).toBe(true);
    expect(config.benchmarks.map((b) => b.id)).toEqual(["riskFree"]);
  });

  it("includes both when both are configured", () => {
    const config = buildBenchmarkConfig({ riskFree: "4.5", basket: "9" });
    expect(config.benchmarks.map((b) => b.id)).toEqual(["riskFree", "basket"]);
  });

  it("puts the rate in the default label", () => {
    const config = buildBenchmarkConfig({ riskFree: "4.5" });
    expect(config.benchmarks[0].defaultLabel).toContain("4.5%");
  });

  it("gives every benchmark an i18n key, colour and dash pattern", () => {
    const config = buildBenchmarkConfig({ riskFree: "4.5", basket: "9" });
    for (const benchmark of config.benchmarks) {
      expect(benchmark.labelKey).toMatch(/^analytics\.benchmarks\./);
      expect(benchmark.color).toMatch(/^#[0-9a-f]{6}$/i);
      // Dashed so it reads as a reference line rather than a data series.
      expect(benchmark.dash).toBeTruthy();
    }
  });

  it("accepts a zero rate as a real configured benchmark", () => {
    const config = buildBenchmarkConfig({ riskFree: "0" });
    expect(config.enabled).toBe(true);
    expect(config.benchmarks[0].apr).toBe(0);
  });
});

describe("compareToBenchmarks", () => {
  const config = buildBenchmarkConfig({ riskFree: "4", basket: "9" });

  it("reports the gap in percentage points", () => {
    const results = compareToBenchmarks(10, config);
    // 10% vs 4% is six *points*, not 150%.
    expect(results[0].delta).toBeCloseTo(6);
    expect(results[1].delta).toBeCloseTo(1);
  });

  it("flags out- and under-performance", () => {
    const results = compareToBenchmarks(5, config);
    expect(results[0].outperforming).toBe(true); // vs 4
    expect(results[1].outperforming).toBe(false); // vs 9
  });

  it("treats an exact match as not outperforming", () => {
    expect(compareToBenchmarks(4, config)[0].outperforming).toBe(false);
  });

  it("returns nothing when no benchmarks are configured", () => {
    expect(compareToBenchmarks(10, buildBenchmarkConfig({}))).toEqual([]);
  });

  it("returns nothing for a non-finite portfolio APR", () => {
    expect(compareToBenchmarks(Number.NaN, config)).toEqual([]);
  });
});

describe("BENCHMARK_DISCLOSURE", () => {
  it("states the rates are static and not advice", () => {
    // An unlabelled baseline on a performance chart implies a live quote.
    expect(BENCHMARK_DISCLOSURE).toMatch(/static/i);
    expect(BENCHMARK_DISCLOSURE).toMatch(/not live market data/i);
    expect(BENCHMARK_DISCLOSURE).toMatch(/not investment advice/i);
  });
});
