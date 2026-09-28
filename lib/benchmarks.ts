/**
 * Configurable performance benchmarks (issue #603).
 *
 * Portfolio charts had no external baseline, so a 9% APR looked identical
 * whether the risk-free rate was 1% or 8%. These overlays give that context
 * without taking a dependency on a live market-data feed: the rates come from
 * build-time env vars, are explicitly labelled as static, and carry a
 * disclosure so nobody mistakes them for a live quote.
 *
 * Parsing is deliberately permissive-but-safe: a malformed value disables that
 * benchmark rather than throwing, because a bad env var should not take the
 * analytics page down. `lib/env.ts` validates required vars strictly; these are
 * optional presentation config and are treated as such.
 */

export interface Benchmark {
  id: "riskFree" | "basket";
  /** Annualised percentage rate, e.g. 4.5 for 4.5%. */
  apr: number;
  /** i18n key for the legend label. */
  labelKey: string;
  /** Fallback label when translations are unavailable. */
  defaultLabel: string;
  color: string;
  /** recharts `strokeDasharray` — dashed to read as a reference, not data. */
  dash: string;
}

export interface BenchmarkConfig {
  benchmarks: Benchmark[];
  /** True when at least one benchmark is configured. */
  enabled: boolean;
}

/** Widest plausible APR. Anything outside is a typo or a unit mix-up. */
const MIN_APR = 0;
const MAX_APR = 100;

/**
 * Parse an APR from an env string.
 *
 * Returns `null` for absent, non-numeric, or out-of-range values so the caller
 * can simply omit that benchmark. A trailing `%` is tolerated because it is the
 * single most likely way someone writes this by hand.
 */
export function parseBenchmarkApr(raw: string | undefined | null): number | null {
  if (raw == null) return null;

  const trimmed = String(raw).trim().replace(/%$/, "");
  if (trimmed === "") return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_APR || value > MAX_APR) return null;

  return value;
}

/**
 * Build the benchmark config from raw env values.
 *
 * Takes the values as arguments rather than reading `process.env` directly so
 * the function is testable and callable from both server and client.
 */
export function buildBenchmarkConfig(source: {
  riskFree?: string | null;
  basket?: string | null;
}): BenchmarkConfig {
  const benchmarks: Benchmark[] = [];

  const riskFree = parseBenchmarkApr(source.riskFree);
  if (riskFree !== null) {
    benchmarks.push({
      id: "riskFree",
      apr: riskFree,
      labelKey: "analytics.benchmarks.riskFree",
      defaultLabel: `Risk-free rate (${riskFree}%)`,
      color: "#94a3b8",
      dash: "6 4",
    });
  }

  const basket = parseBenchmarkApr(source.basket);
  if (basket !== null) {
    benchmarks.push({
      id: "basket",
      apr: basket,
      labelKey: "analytics.benchmarks.basket",
      defaultLabel: `Basket APR (${basket}%)`,
      color: "#a78bfa",
      dash: "3 3",
    });
  }

  return { benchmarks, enabled: benchmarks.length > 0 };
}

/**
 * Read the configuration from the environment.
 *
 * `NEXT_PUBLIC_*` reads are written out in full rather than indexed, because
 * Next.js inlines these at build time by literal match — `process.env[key]`
 * would silently be `undefined` in the browser bundle.
 */
export function getBenchmarkConfig(): BenchmarkConfig {
  return buildBenchmarkConfig({
    riskFree: process.env.NEXT_PUBLIC_BENCHMARK_RISK_FREE_APR,
    basket: process.env.NEXT_PUBLIC_BENCHMARK_BASKET_APR,
  });
}

/**
 * Compare a portfolio APR against each configured benchmark.
 *
 * `delta` is in percentage *points* — the difference between two rates, not a
 * percentage change of one. Mixing those up is the classic way to report
 * "outperforming by 400%" when the real answer is four points.
 */
export function compareToBenchmarks(
  portfolioApr: number,
  config: BenchmarkConfig
): Array<{ benchmark: Benchmark; delta: number; outperforming: boolean }> {
  if (!Number.isFinite(portfolioApr)) return [];

  return config.benchmarks.map((benchmark) => {
    const delta = portfolioApr - benchmark.apr;
    return { benchmark, delta, outperforming: delta > 0 };
  });
}

/**
 * The disclosure shown beside the legend.
 *
 * Not optional: an unlabelled baseline on a performance chart implies a live
 * market comparison, and these are static configured values.
 */
export const BENCHMARK_DISCLOSURE =
  "Benchmarks are static, operator-configured reference rates — not live market data. " +
  "They are shown for context only and are not investment advice.";
