/**
 * Portfolio allocation treemap (issue #600).
 *
 * A pie chart shows one dimension at a time. A treemap nests two, so an
 * investor can see "how much of my AAA exposure sits in a single jurisdiction"
 * without switching views — which is the question concentration risk actually
 * turns on.
 *
 * The mapping lives here rather than in the chart component so it is testable
 * without mounting recharts, and so the accessible description is derived from
 * the same numbers the rectangles are drawn from.
 */

import {
  JURISDICTION_PALETTE,
  RISK_TIER_PALETTE,
  type AllocatablePosition,
  type AllocationDimension,
} from "@/lib/portfolioAllocation";

/** Fallback for a value with no palette entry. */
const NEUTRAL = "#94a3b8";

export interface TreemapLeaf {
  /** Value of the inner dimension, e.g. a jurisdiction code. */
  name: string;
  /** Invested amount in this cell. */
  value: number;
  /** Share of the parent group, 0–100. */
  percentOfGroup: number;
  /** Share of the whole portfolio, 0–100. */
  percentOfTotal: number;
  color: string;
}

export interface TreemapGroup {
  /** Value of the outer dimension, e.g. a risk tier. */
  name: string;
  /** Sum of the group's children. */
  value: number;
  /** Share of the whole portfolio, 0–100. */
  percentOfTotal: number;
  color: string;
  children: TreemapLeaf[];
}

export interface TreemapModel {
  groups: TreemapGroup[];
  total: number;
}

function paletteFor(dimension: AllocationDimension): Record<string, string> {
  if (dimension === "riskTier") return RISK_TIER_PALETTE;
  if (dimension === "jurisdiction") return JURISDICTION_PALETTE;
  return {};
}

function colorFor(dimension: AllocationDimension, name: string): string {
  return paletteFor(dimension)[name] ?? NEUTRAL;
}

/**
 * Read one dimension off a position.
 *
 * Mirrors `portfolioAllocation`'s private `dimensionKey`, including its
 * fallbacks, so a position lands in the same bucket in both views. A position
 * missing metadata is bucketed rather than dropped — silently excluding it
 * would understate the portfolio total and make every percentage wrong.
 */
export function treemapDimensionKey(
  position: AllocatablePosition,
  dimension: AllocationDimension
): string {
  switch (dimension) {
    case "riskTier":
      return position.invoice?.riskTier ?? "Unknown";
    case "jurisdiction":
      return position.invoice?.metadata?.jurisdiction ?? "OTHER";
    case "category":
      return position.invoice?.metadata?.category ?? "other";
  }
}

/**
 * Nest positions into `outer -> inner` groups sized by invested amount.
 *
 * Groups and leaves are both sorted descending by value, so the largest
 * exposure is the top-left rectangle — the one a reader looks at first.
 *
 * Returns an empty model (not a zero-filled one) when nothing qualifies, so
 * callers can distinguish "no data" from "all zeros" and render an empty state.
 */
export function buildTreemapModel(
  positions: AllocatablePosition[],
  outer: AllocationDimension = "riskTier",
  inner: AllocationDimension = "jurisdiction"
): TreemapModel {
  const grouped = new Map<string, Map<string, number>>();
  let total = 0;

  for (const position of positions) {
    const amount = position.investedAmount;
    // Guard non-finite as well as non-positive: a NaN amount would poison
    // every percentage downstream.
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const outerKey = treemapDimensionKey(position, outer);
    const innerKey = treemapDimensionKey(position, inner);

    const leaves = grouped.get(outerKey) ?? new Map<string, number>();
    leaves.set(innerKey, (leaves.get(innerKey) ?? 0) + amount);
    grouped.set(outerKey, leaves);
    total += amount;
  }

  if (total === 0) return { groups: [], total: 0 };

  const groups: TreemapGroup[] = [...grouped.entries()]
    .map(([name, leaves]) => {
      const groupValue = [...leaves.values()].reduce((sum, v) => sum + v, 0);

      const children: TreemapLeaf[] = [...leaves.entries()]
        .map(([leafName, value]) => ({
          name: leafName,
          value,
          percentOfGroup: (value / groupValue) * 100,
          percentOfTotal: (value / total) * 100,
          color: colorFor(inner, leafName),
        }))
        .sort((a, b) => b.value - a.value);

      return {
        name,
        value: groupValue,
        percentOfTotal: (groupValue / total) * 100,
        color: colorFor(outer, name),
        children,
      };
    })
    .sort((a, b) => b.value - a.value);

  return { groups, total };
}

/** Shape recharts' `<Treemap>` consumes: a flat list of nodes with children. */
export interface TreemapSeriesNode {
  name: string;
  size?: number;
  color: string;
  percentOfTotal: number;
  children?: TreemapSeriesNode[];
}

/** Project the model into the series shape recharts expects. */
export function toTreemapSeries(model: TreemapModel): TreemapSeriesNode[] {
  return model.groups.map((group) => ({
    name: group.name,
    color: group.color,
    percentOfTotal: group.percentOfTotal,
    children: group.children.map((leaf) => ({
      name: leaf.name,
      // recharts sizes leaves by `size`, not `value`.
      size: leaf.value,
      color: leaf.color,
      percentOfTotal: leaf.percentOfTotal,
    })),
  }));
}

/**
 * A sentence describing the whole treemap, for `role="img"`.
 *
 * Matches the pattern the other charts in `AnalyticsCharts` use: a screen
 * reader gets the actual numbers rather than an anonymous graphic.
 */
export function describeTreemap(
  model: TreemapModel,
  formatCurrency: (value: number) => string,
  outerLabel = "risk tier",
  innerLabel = "jurisdiction"
): string {
  const title = `Portfolio allocation by ${outerLabel} and ${innerLabel}`;
  if (model.groups.length === 0) return `${title}. No data available.`;

  const parts = model.groups.map((group) => {
    const children = group.children
      .map(
        (leaf) =>
          `${leaf.name} ${formatCurrency(leaf.value)} (${leaf.percentOfGroup.toFixed(1)}% of tier)`
      )
      .join(", ");
    return `${group.name}: ${formatCurrency(group.value)}, ${group.percentOfTotal.toFixed(1)}% of portfolio — ${children}`;
  });

  return `${title}. Total ${formatCurrency(model.total)} across ${model.groups.length} ${outerLabel} groups. ${parts.join(". ")}.`;
}

/**
 * The single largest `outer -> inner` cell, or `null` when empty.
 *
 * Surfaced as a concentration callout: the treemap makes this visible at a
 * glance for sighted users, and this makes the same point in text.
 */
export function largestConcentration(
  model: TreemapModel
): { group: string; leaf: string; percentOfTotal: number } | null {
  let best: { group: string; leaf: string; percentOfTotal: number } | null = null;

  for (const group of model.groups) {
    for (const leaf of group.children) {
      if (!best || leaf.percentOfTotal > best.percentOfTotal) {
        best = {
          group: group.name,
          leaf: leaf.name,
          percentOfTotal: leaf.percentOfTotal,
        };
      }
    }
  }

  return best;
}
