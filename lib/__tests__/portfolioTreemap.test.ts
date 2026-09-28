/**
 * Treemap data-mapping tests (issue #600).
 */

import { describe, it, expect } from "vitest";
import {
  buildTreemapModel,
  describeTreemap,
  largestConcentration,
  toTreemapSeries,
  treemapDimensionKey,
} from "@/lib/portfolioTreemap";
import type { AllocatablePosition } from "@/lib/portfolioAllocation";

function position(
  investedAmount: number,
  riskTier?: string,
  jurisdiction?: string,
  category?: string
): AllocatablePosition {
  return {
    investedAmount,
    invoice: {
      riskTier,
      metadata: { jurisdiction, category },
    },
  };
}

const money = (v: number) => `$${v.toFixed(2)}`;

describe("treemapDimensionKey", () => {
  it("reads each dimension off the position", () => {
    const p = position(100, "AAA", "US", "logistics");
    expect(treemapDimensionKey(p, "riskTier")).toBe("AAA");
    expect(treemapDimensionKey(p, "jurisdiction")).toBe("US");
    expect(treemapDimensionKey(p, "category")).toBe("logistics");
  });

  it("falls back rather than dropping a position with no metadata", () => {
    const bare: AllocatablePosition = { investedAmount: 10 };
    expect(treemapDimensionKey(bare, "riskTier")).toBe("Unknown");
    expect(treemapDimensionKey(bare, "jurisdiction")).toBe("OTHER");
    expect(treemapDimensionKey(bare, "category")).toBe("other");
  });
});

describe("buildTreemapModel", () => {
  it("nests inner groups inside outer groups", () => {
    const model = buildTreemapModel([
      position(100, "AAA", "US"),
      position(50, "AAA", "EU"),
      position(25, "BB", "NG"),
    ]);

    expect(model.total).toBe(175);
    expect(model.groups.map((g) => g.name)).toEqual(["AAA", "BB"]);

    const aaa = model.groups[0];
    expect(aaa.value).toBe(150);
    expect(aaa.children.map((c) => c.name)).toEqual(["US", "EU"]);
  });

  it("sums positions that share a cell", () => {
    const model = buildTreemapModel([position(30, "AAA", "US"), position(70, "AAA", "US")]);

    expect(model.groups[0].children).toHaveLength(1);
    expect(model.groups[0].children[0].value).toBe(100);
  });

  it("sorts groups and leaves by value, largest first", () => {
    const model = buildTreemapModel([
      position(10, "AAA", "US"),
      position(90, "BB", "EU"),
      position(40, "BB", "UK"),
    ]);

    expect(model.groups.map((g) => g.name)).toEqual(["BB", "AAA"]);
    expect(model.groups[0].children.map((c) => c.name)).toEqual(["EU", "UK"]);
  });

  it("computes percentages against the group and the whole portfolio", () => {
    const model = buildTreemapModel([
      position(75, "AAA", "US"),
      position(25, "AAA", "EU"),
      position(100, "BB", "NG"),
    ]);

    const aaa = model.groups.find((g) => g.name === "AAA")!;
    expect(aaa.percentOfTotal).toBeCloseTo(50);

    const us = aaa.children.find((c) => c.name === "US")!;
    expect(us.percentOfGroup).toBeCloseTo(75);
    expect(us.percentOfTotal).toBeCloseTo(37.5);
  });

  it("group percentages sum to 100", () => {
    const model = buildTreemapModel([
      position(13, "AAA", "US"),
      position(29, "BB", "EU"),
      position(58, "A", "NG"),
    ]);

    const sum = model.groups.reduce((acc, g) => acc + g.percentOfTotal, 0);
    expect(sum).toBeCloseTo(100);
  });

  it("skips non-positive and non-finite amounts", () => {
    const model = buildTreemapModel([
      position(100, "AAA", "US"),
      position(0, "BB", "EU"),
      position(-50, "A", "NG"),
      position(Number.NaN, "CCC", "UK"),
    ]);

    expect(model.total).toBe(100);
    expect(model.groups).toHaveLength(1);
  });

  it("returns an empty model when nothing qualifies", () => {
    expect(buildTreemapModel([])).toEqual({ groups: [], total: 0 });
    expect(buildTreemapModel([position(0, "AAA", "US")])).toEqual({
      groups: [],
      total: 0,
    });
  });

  it("buckets positions with missing metadata instead of dropping them", () => {
    const model = buildTreemapModel([position(100, "AAA", "US"), { investedAmount: 100 }]);

    // Dropping the bare position would understate the total and make every
    // percentage wrong.
    expect(model.total).toBe(200);
    expect(model.groups.map((g) => g.name).sort()).toEqual(["AAA", "Unknown"]);
  });

  it("honours a custom dimension pairing", () => {
    const model = buildTreemapModel(
      [position(100, "AAA", "US", "logistics")],
      "jurisdiction",
      "category"
    );

    expect(model.groups[0].name).toBe("US");
    expect(model.groups[0].children[0].name).toBe("logistics");
  });

  it("assigns palette colours by dimension", () => {
    const model = buildTreemapModel([position(100, "AAA", "US")]);
    expect(model.groups[0].color).toBe("#10b981"); // RISK_TIER_PALETTE.AAA
    expect(model.groups[0].children[0].color).toBe("#818cf8"); // JURISDICTION US
  });

  it("falls back to a neutral colour for unknown values", () => {
    const model = buildTreemapModel([position(100, "ZZZ", "MARS")]);
    expect(model.groups[0].color).toBe("#94a3b8");
    expect(model.groups[0].children[0].color).toBe("#94a3b8");
  });
});

describe("toTreemapSeries", () => {
  it("maps leaves to recharts' `size` key", () => {
    const series = toTreemapSeries(
      buildTreemapModel([position(100, "AAA", "US"), position(50, "AAA", "EU")])
    );

    expect(series).toHaveLength(1);
    expect(series[0].name).toBe("AAA");
    expect(series[0].children?.map((c) => c.size)).toEqual([100, 50]);
  });

  it("returns an empty series for an empty model", () => {
    expect(toTreemapSeries({ groups: [], total: 0 })).toEqual([]);
  });
});

describe("describeTreemap", () => {
  it("states the total and every cell", () => {
    const label = describeTreemap(
      buildTreemapModel([position(75, "AAA", "US"), position(25, "AAA", "EU")]),
      money
    );

    expect(label).toContain("Portfolio allocation by risk tier and jurisdiction");
    expect(label).toContain("$100.00");
    expect(label).toContain("US");
    expect(label).toContain("EU");
  });

  it("announces an empty portfolio", () => {
    expect(describeTreemap({ groups: [], total: 0 }, money)).toContain("No data available");
  });
});

describe("largestConcentration", () => {
  it("finds the single biggest cell across all groups", () => {
    const model = buildTreemapModel([
      position(10, "AAA", "US"),
      position(60, "BB", "EU"),
      position(30, "BB", "UK"),
    ]);

    const top = largestConcentration(model)!;
    expect(top.group).toBe("BB");
    expect(top.leaf).toBe("EU");
    expect(top.percentOfTotal).toBeCloseTo(60);
  });

  it("returns null for an empty model", () => {
    expect(largestConcentration({ groups: [], total: 0 })).toBeNull();
  });
});
