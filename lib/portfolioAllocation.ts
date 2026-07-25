/**
 * Portfolio allocation helpers — aggregate live investor positions
 * by risk tier, jurisdiction, and category for donut charts and
 * marketplace drill-down links.
 */

import type { FilterState } from "@/store/invoiceStore";
import { DEFAULT_FILTERS, toQueryParams } from "@/store/invoiceStore";

export type AllocationDimension = "riskTier" | "jurisdiction" | "category";

export interface AllocationFilter {
  dimension: AllocationDimension;
  value: string;
}

/** Minimal position shape needed for allocation aggregation. */
export interface AllocatablePosition {
  investedAmount: number;
  invoice?: {
    riskTier?: string;
    metadata?: {
      jurisdiction?: string;
      category?: string;
    };
  } | null;
}

export interface AllocationSlice {
  name: string;
  value: number;
  percent: number;
  color: string;
}

export const RISK_TIER_PALETTE: Record<string, string> = {
  AAA: "#10b981",
  AA: "#14b8a6",
  A: "#06b6d4",
  BBB: "#f59e0b",
  BB: "#f97316",
  B: "#ef4444",
  CCC: "#dc2626",
};

export const JURISDICTION_PALETTE: Record<string, string> = {
  US: "#818cf8",
  EU: "#a78bfa",
  UK: "#c084fc",
  NG: "#34d399",
  KE: "#2dd4bf",
  GH: "#22d3ee",
  ZA: "#60a5fa",
  OTHER: "#94a3b8",
};

const CATEGORY_PALETTE: string[] = [
  "#14b8a6",
  "#818cf8",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#06b6d4",
  "#f97316",
  "#a78bfa",
  "#34d399",
  "#60a5fa",
];

function getCategoryColor(index: number): string {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

function dimensionKey(
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
 * Aggregate invested amounts by the given dimension and return
 * sorted slices with percentage of total portfolio.
 */
export function aggregatePositions(
  positions: AllocatablePosition[],
  dimension: AllocationDimension
): AllocationSlice[] {
  const totals: Record<string, number> = {};

  for (const pos of positions) {
    if (!pos.investedAmount || pos.investedAmount <= 0) continue;
    const key = dimensionKey(pos, dimension);
    totals[key] = (totals[key] ?? 0) + pos.investedAmount;
  }

  const grandTotal = Object.values(totals).reduce((sum, v) => sum + v, 0);
  if (grandTotal === 0) return [];

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  return entries.map(([name, value], idx) => {
    let color: string;
    if (dimension === "riskTier") color = RISK_TIER_PALETTE[name] ?? "#94a3b8";
    else if (dimension === "jurisdiction")
      color = JURISDICTION_PALETTE[name] ?? "#94a3b8";
    else color = getCategoryColor(idx);

    return {
      name,
      value,
      percent: (value / grandTotal) * 100,
      color,
    };
  });
}

/** Filter a position list by an active allocation drill-down. */
export function filterPositionsByAllocation<T extends AllocatablePosition>(
  positions: T[],
  filter: AllocationFilter | null
): T[] {
  if (!filter) return positions;
  return positions.filter((p) => dimensionKey(p, filter.dimension) === filter.value);
}

/** Map an allocation segment click to marketplace FilterState fields. */
export function allocationToMarketplaceFilters(
  filter: AllocationFilter
): Partial<FilterState> {
  switch (filter.dimension) {
    case "riskTier":
      return { riskTiers: [filter.value] };
    case "jurisdiction":
      return { jurisdictions: [filter.value] };
    case "category":
      return { categories: [filter.value] };
  }
}

/** Build a marketplace path with query params for the given allocation filter. */
export function marketplacePathForAllocation(filter: AllocationFilter): string {
  const filters: FilterState = {
    ...DEFAULT_FILTERS,
    ...allocationToMarketplaceFilters(filter),
  };
  const params = toQueryParams(filters, { sortBy: "apr", sortDir: "desc" });
  const qs = params.toString();
  return qs ? `/marketplace?${qs}` : "/marketplace";
}
