/**
 * Unit tests for portfolio allocation aggregation and marketplace drill-down helpers.
 */

import { describe, it, expect } from "vitest";
import {
  aggregatePositions,
  buildPortfolioTimeSeries,
  filterPositionsByAllocation,
  allocationToMarketplaceFilters,
  marketplacePathForAllocation,
  type AllocatablePosition,
} from "../portfolioAllocation";

function timeSeriesPosition(investedAt: string, investedAmount: number, expectedReturn: number) {
  return { investedAt, investedAmount, expectedReturn };
}

describe("buildPortfolioTimeSeries", () => {
  it("groups live positions by month and builds cumulative portfolio value", () => {
    const series = buildPortfolioTimeSeries([
      timeSeriesPosition("2026-02-10T00:00:00.000Z", 500, 550),
      timeSeriesPosition("2026-01-15T00:00:00.000Z", 1000, 1100),
      timeSeriesPosition("2026-02-20T00:00:00.000Z", 1500, 1650),
    ]);

    expect(series.portfolio).toEqual([
      { month: "Jan 2026", value: 1000 },
      { month: "Feb 2026", value: 3000 },
    ]);
    expect(series.yieldData).toEqual([
      { month: "Jan 2026", yield: 100 },
      { month: "Feb 2026", yield: 200 },
    ]);
    expect(series.monthly).toEqual([
      { month: "Jan 2026", return: 10 },
      { month: "Feb 2026", return: 10 },
    ]);
  });

  it("returns a zero baseline instead of fake growth for an empty portfolio", () => {
    expect(buildPortfolioTimeSeries([], new Date("2026-08-27T12:00:00.000Z"))).toEqual({
      portfolio: [{ month: "Aug 2026", value: 0 }],
      yieldData: [{ month: "Aug 2026", yield: 0 }],
      monthly: [{ month: "Aug 2026", return: 0 }],
    });
  });

  it("ignores invalid dates and non-positive investments", () => {
    const series = buildPortfolioTimeSeries(
      [
        timeSeriesPosition("not-a-date", 1000, 1100),
        timeSeriesPosition("2026-01-01T00:00:00.000Z", 0, 100),
      ],
      new Date("2026-03-01T00:00:00.000Z")
    );

    expect(series.portfolio).toEqual([{ month: "Mar 2026", value: 0 }]);
  });

  it("clamps negative or invalid expected yield to zero", () => {
    const series = buildPortfolioTimeSeries([
      timeSeriesPosition("2026-01-15T00:00:00.000Z", 1000, 900),
      timeSeriesPosition("2026-01-20T00:00:00.000Z", 500, Number.NaN),
    ]);

    expect(series.yieldData).toEqual([{ month: "Jan 2026", yield: 0 }]);
    expect(series.monthly).toEqual([{ month: "Jan 2026", return: 0 }]);
  });
});

function pos(
  investedAmount: number,
  opts: {
    riskTier?: string;
    jurisdiction?: string;
    category?: string;
  } = {}
): AllocatablePosition {
  return {
    investedAmount,
    invoice: {
      riskTier: opts.riskTier,
      metadata: {
        jurisdiction: opts.jurisdiction,
        category: opts.category,
      },
    },
  };
}

describe("aggregatePositions", () => {
  const positions = [
    pos(10000, { riskTier: "AAA", jurisdiction: "KE", category: "technology" }),
    pos(20000, { riskTier: "A", jurisdiction: "KE", category: "healthcare" }),
    pos(10000, { riskTier: "AAA", jurisdiction: "NG", category: "technology" }),
  ];

  it("aggregates by risk tier with correct percents", () => {
    const slices = aggregatePositions(positions, "riskTier");
    expect(slices).toHaveLength(2);
    const aaa = slices.find((s) => s.name === "AAA");
    const a = slices.find((s) => s.name === "A");
    expect(aaa?.value).toBe(20000);
    expect(aaa?.percent).toBe(50);
    expect(a?.value).toBe(20000);
    expect(a?.percent).toBe(50);
  });

  it("aggregates by jurisdiction sorted by value desc", () => {
    const slices = aggregatePositions(positions, "jurisdiction");
    expect(slices[0].name).toBe("KE");
    expect(slices[0].value).toBe(30000);
    expect(slices[0].percent).toBe(75);
    expect(slices[1].name).toBe("NG");
    expect(slices[1].percent).toBe(25);
  });

  it("aggregates by category", () => {
    const slices = aggregatePositions(positions, "category");
    const tech = slices.find((s) => s.name === "technology");
    expect(tech?.value).toBe(20000);
    expect(tech?.percent).toBe(50);
  });

  it("returns empty array for empty portfolio", () => {
    expect(aggregatePositions([], "riskTier")).toEqual([]);
  });

  it("skips zero / missing invested amounts", () => {
    const slices = aggregatePositions(
      [pos(0, { riskTier: "AAA" }), pos(5000, { riskTier: "AA" })],
      "riskTier"
    );
    expect(slices).toHaveLength(1);
    expect(slices[0].name).toBe("AA");
    expect(slices[0].percent).toBe(100);
  });

  it("uses Unknown / OTHER / other fallbacks when invoice metadata missing", () => {
    const slices = aggregatePositions([{ investedAmount: 1000 }], "riskTier");
    expect(slices[0].name).toBe("Unknown");
    const jurisdictions = aggregatePositions(
      [{ investedAmount: 1000 }],
      "jurisdiction"
    );
    expect(jurisdictions[0].name).toBe("OTHER");
    const categories = aggregatePositions([{ investedAmount: 1000 }], "category");
    expect(categories[0].name).toBe("other");
  });
});

describe("filterPositionsByAllocation", () => {
  const positions = [
    pos(10000, { riskTier: "AAA", jurisdiction: "KE", category: "technology" }),
    pos(20000, { riskTier: "A", jurisdiction: "NG", category: "healthcare" }),
  ];

  it("returns all positions when filter is null", () => {
    expect(filterPositionsByAllocation(positions, null)).toHaveLength(2);
  });

  it("filters by risk tier", () => {
    const filtered = filterPositionsByAllocation(positions, {
      dimension: "riskTier",
      value: "AAA",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].investedAmount).toBe(10000);
  });

  it("filters by jurisdiction", () => {
    const filtered = filterPositionsByAllocation(positions, {
      dimension: "jurisdiction",
      value: "NG",
    });
    expect(filtered).toHaveLength(1);
  });
});

describe("marketplace drill-down helpers", () => {
  it("maps risk tier filter to marketplace filters", () => {
    expect(
      allocationToMarketplaceFilters({ dimension: "riskTier", value: "AA" })
    ).toEqual({ riskTiers: ["AA"] });
  });

  it("maps jurisdiction filter to marketplace filters", () => {
    expect(
      allocationToMarketplaceFilters({
        dimension: "jurisdiction",
        value: "KE",
      })
    ).toEqual({ jurisdictions: ["KE"] });
  });

  it("maps category filter to marketplace filters", () => {
    expect(
      allocationToMarketplaceFilters({
        dimension: "category",
        value: "technology",
      })
    ).toEqual({ categories: ["technology"] });
  });

  it("builds marketplace path with riskTiers query", () => {
    const path = marketplacePathForAllocation({
      dimension: "riskTier",
      value: "BBB",
    });
    expect(path).toBe("/marketplace?riskTiers=BBB");
  });

  it("builds marketplace path with jurisdictions query", () => {
    const path = marketplacePathForAllocation({
      dimension: "jurisdiction",
      value: "US",
    });
    expect(path).toBe("/marketplace?jurisdictions=US");
  });

  it("builds marketplace path with categories query", () => {
    const path = marketplacePathForAllocation({
      dimension: "category",
      value: "agriculture",
    });
    expect(path).toBe("/marketplace?categories=agriculture");
  });
});
