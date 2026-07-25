/**
 * Unit tests for portfolio allocation aggregation and marketplace drill-down helpers.
 */

import { describe, it, expect } from "vitest";
import {
  aggregatePositions,
  filterPositionsByAllocation,
  allocationToMarketplaceFilters,
  marketplacePathForAllocation,
  type AllocatablePosition,
} from "../portfolioAllocation";

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
