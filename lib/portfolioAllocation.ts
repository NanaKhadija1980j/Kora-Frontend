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

/** Minimal live-position shape needed for the analytics time-series. */
export interface TimeSeriesPosition extends AllocatablePosition {
  investedAt: string;
  expectedReturn: number;
}

export interface PortfolioValuePoint {
  month: string;
  value: number;
}

export interface YieldPoint {
  month: string;
  yield: number;
}

export interface MonthlyReturnPoint {
  month: string;
  return: number;
}

export interface PortfolioTimeSeries {
  portfolio: PortfolioValuePoint[];
  yieldData: YieldPoint[];
  monthly: MonthlyReturnPoint[];
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

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * Build the chart series from live positions grouped by their investment month.
 * Portfolio value is cumulative; expected yield and return rate are monthly.
 * Invalid dates and non-positive investments are ignored.
 */
export function buildPortfolioTimeSeries(
  positions: TimeSeriesPosition[],
  baselineDate: Date = new Date()
): PortfolioTimeSeries {
  const buckets = new Map<string, { invested: number; expectedYield: number }>();

  for (const position of positions) {
    const investedAt = new Date(position.investedAt);
    const invested = Number(position.investedAmount);
    const expectedReturn = Number(position.expectedReturn);

    if (Number.isNaN(investedAt.getTime()) || !Number.isFinite(invested) || invested <= 0) {
      continue;
    }

    const key = monthKey(investedAt);
    const bucket = buckets.get(key) ?? { invested: 0, expectedYield: 0 };
    bucket.invested += invested;
    bucket.expectedYield += Number.isFinite(expectedReturn)
      ? Math.max(0, expectedReturn - invested)
      : 0;
    buckets.set(key, bucket);
  }

  if (buckets.size === 0) {
    const month = monthLabel(monthKey(baselineDate));
    return {
      portfolio: [{ month, value: 0 }],
      yieldData: [{ month, yield: 0 }],
      monthly: [{ month, return: 0 }],
    };
  }

  let portfolioValue = 0;
  const portfolio: PortfolioValuePoint[] = [];
  const yieldData: YieldPoint[] = [];
  const monthly: MonthlyReturnPoint[] = [];

  for (const [key, bucket] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const month = monthLabel(key);
    portfolioValue += bucket.invested;
    portfolio.push({ month, value: portfolioValue });
    yieldData.push({ month, yield: bucket.expectedYield });
    monthly.push({
      month,
      return: (bucket.expectedYield / bucket.invested) * 100,
    });
  }

  return { portfolio, yieldData, monthly };
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
