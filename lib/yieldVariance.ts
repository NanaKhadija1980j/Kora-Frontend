/**
 * Realized vs expected yield variance (issue #601).
 *
 * `expectedReturn` is what the position was underwritten to pay; `yieldEarned`
 * is what it has actually paid. The gap is the number an investor needs to
 * judge under- or over-performance against APR expectations, and nothing in
 * the app surfaced it.
 *
 * Status drives the interpretation, so it is modelled explicitly rather than
 * inferred from the numbers:
 *
 * - `repaid`    — settled. Realized is final, so variance is real.
 * - `active`    — still running. Expected-only: showing a negative variance
 *                 for a position that simply has not matured yet would read as
 *                 underperformance, which is wrong and alarming.
 * - `defaulted` — realized is final at whatever was recovered. The shortfall
 *                 is the loss, and it belongs in the aggregate.
 */

import type { InvestorPosition } from "@/types/invoice";

export type VarianceStatus = "repaid" | "active" | "defaulted";

export interface PositionVariance {
  positionId: string;
  invoiceId: string;
  /** Human label for the row — invoice number when available. */
  label: string;
  status: VarianceStatus;
  investedAmount: number;
  /** Yield the position was underwritten to produce (return minus principal). */
  expectedYield: number;
  /** Yield actually received so far. */
  realizedYield: number;
  /**
   * `realized - expected`, or `null` while the position is still active and a
   * comparison would be meaningless.
   */
  variance: number | null;
  /** Variance as a share of expected yield (%), or `null` when not comparable. */
  variancePercent: number | null;
  /** ISO date the position was opened, used for time bucketing. */
  investedAt: string;
}

export interface VarianceAggregate {
  totalExpectedYield: number;
  totalRealizedYield: number;
  /** Sum of variance across *settled* positions only. */
  totalVariance: number;
  /** Aggregate variance as a share of settled expected yield (%). */
  totalVariancePercent: number | null;
  settledCount: number;
  pendingCount: number;
  outperformingCount: number;
  underperformingCount: number;
}

export interface VariancePoint {
  /** `YYYY-MM` bucket. */
  month: string;
  expected: number;
  realized: number;
  variance: number;
}

/** A position is comparable once it has stopped accruing. */
export function isSettled(status: string): boolean {
  return status === "repaid" || status === "defaulted";
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Derive per-position variance.
 *
 * Expected yield is `expectedReturn - investedAmount` rather than
 * `expectedReturn`: the return figure includes the returned principal, and
 * comparing it against `yieldEarned` (which does not) would overstate every
 * shortfall by the size of the investment.
 */
export function computePositionVariance(position: InvestorPosition): PositionVariance {
  const invested = safeNumber(position.investedAmount);
  const expectedYield = Math.max(0, safeNumber(position.expectedReturn) - invested);
  const realizedYield = safeNumber(position.yieldEarned);
  const settled = isSettled(position.status);

  const variance = settled ? realizedYield - expectedYield : null;
  const variancePercent =
    settled && expectedYield > 0 ? ((realizedYield - expectedYield) / expectedYield) * 100 : null;

  return {
    positionId: position.id,
    invoiceId: position.invoiceId,
    label: position.invoice?.metadata?.invoiceNumber || position.invoiceId || position.id,
    status: position.status as VarianceStatus,
    investedAmount: invested,
    expectedYield,
    realizedYield,
    variance,
    variancePercent,
    investedAt: position.investedAt,
  };
}

export function computeVarianceRows(positions: InvestorPosition[]): PositionVariance[] {
  return positions.map(computePositionVariance);
}

/**
 * Roll rows up into portfolio totals.
 *
 * Only settled positions contribute to `totalVariance`. Active positions still
 * contribute their expected yield to `totalExpectedYield`, so the figure stays
 * a forward-looking view of the whole book while variance stays honest.
 */
export function aggregateVariance(rows: PositionVariance[]): VarianceAggregate {
  let totalExpectedYield = 0;
  let totalRealizedYield = 0;
  let settledExpected = 0;
  let totalVariance = 0;
  let settledCount = 0;
  let pendingCount = 0;
  let outperformingCount = 0;
  let underperformingCount = 0;

  for (const row of rows) {
    totalExpectedYield += row.expectedYield;
    totalRealizedYield += row.realizedYield;

    if (row.variance === null) {
      pendingCount += 1;
      continue;
    }

    settledCount += 1;
    settledExpected += row.expectedYield;
    totalVariance += row.variance;
    if (row.variance > 0) outperformingCount += 1;
    else if (row.variance < 0) underperformingCount += 1;
  }

  return {
    totalExpectedYield,
    totalRealizedYield,
    totalVariance,
    totalVariancePercent: settledExpected > 0 ? (totalVariance / settledExpected) * 100 : null,
    settledCount,
    pendingCount,
    outperformingCount,
    underperformingCount,
  };
}

/** `YYYY-MM` for an ISO date, or `null` if unparseable. */
function monthBucket(iso: string): string | null {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Bucket rows into a chronological expected-vs-realized series.
 *
 * Rows with an unparseable `investedAt` are skipped rather than bucketed under
 * a placeholder month, which would distort the timeline.
 */
export function buildVarianceSeries(rows: PositionVariance[]): VariancePoint[] {
  const buckets = new Map<string, { expected: number; realized: number }>();

  for (const row of rows) {
    const month = monthBucket(row.investedAt);
    if (!month) continue;

    const bucket = buckets.get(month) ?? { expected: 0, realized: 0 };
    bucket.expected += row.expectedYield;
    bucket.realized += row.realizedYield;
    buckets.set(month, bucket);
  }

  return [...buckets.entries()]
    .map(([month, { expected, realized }]) => ({
      month,
      expected,
      realized,
      variance: realized - expected,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export const VARIANCE_EXPORT_HEADERS = [
  "Invoice ID",
  "Status",
  "Invested",
  "Expected Yield",
  "Realized Yield",
  "Variance",
  "Variance %",
] as const;

export type VarianceExportHeader = (typeof VARIANCE_EXPORT_HEADERS)[number];
export type VarianceExportRow = Record<VarianceExportHeader, string | number>;

/**
 * Flatten rows for CSV export.
 *
 * Unsettled positions export an empty variance rather than `0` — a zero would
 * be indistinguishable from "performed exactly to plan".
 */
export function varianceToExportRows(rows: PositionVariance[]): VarianceExportRow[] {
  return rows.map((row) => ({
    "Invoice ID": row.label,
    Status: row.status,
    Invested: row.investedAmount,
    "Expected Yield": Number(row.expectedYield.toFixed(2)),
    "Realized Yield": Number(row.realizedYield.toFixed(2)),
    Variance: row.variance === null ? "" : Number(row.variance.toFixed(2)),
    "Variance %": row.variancePercent === null ? "" : Number(row.variancePercent.toFixed(2)),
  }));
}

/** Dated filename for the variance CSV. */
export function varianceExportFilename(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `kora-yield-variance-${yyyy}-${mm}-${dd}.csv`;
}
