/**
 * Realized vs expected yield variance tests (issue #601).
 */

import { describe, it, expect } from "vitest";
import {
  aggregateVariance,
  buildVarianceSeries,
  computePositionVariance,
  computeVarianceRows,
  isSettled,
  varianceExportFilename,
  varianceToExportRows,
} from "@/lib/yieldVariance";
import type { InvestorPosition } from "@/types/invoice";

function position(overrides: Partial<InvestorPosition> = {}): InvestorPosition {
  return {
    id: "pos-1",
    invoiceId: "inv-1",
    investedAmount: 1000,
    expectedReturn: 1100,
    yieldEarned: 0,
    investedAt: "2026-01-15T00:00:00.000Z",
    status: "active",
    ...overrides,
  } as InvestorPosition;
}

describe("isSettled", () => {
  it("treats repaid and defaulted as settled", () => {
    expect(isSettled("repaid")).toBe(true);
    expect(isSettled("defaulted")).toBe(true);
    expect(isSettled("active")).toBe(false);
  });
});

describe("computePositionVariance", () => {
  it("derives expected yield as return minus principal", () => {
    const row = computePositionVariance(position({ investedAmount: 1000, expectedReturn: 1100 }));
    // Not 1100 — that includes the returned principal, and comparing it to
    // yieldEarned would overstate the shortfall by the whole investment.
    expect(row.expectedYield).toBe(100);
  });

  it("reports a positive variance when a position outperforms", () => {
    const row = computePositionVariance(
      position({ status: "repaid", expectedReturn: 1100, yieldEarned: 130 })
    );
    expect(row.variance).toBe(30);
    expect(row.variancePercent).toBeCloseTo(30);
  });

  it("reports a negative variance when a position underperforms", () => {
    const row = computePositionVariance(
      position({ status: "repaid", expectedReturn: 1100, yieldEarned: 60 })
    );
    expect(row.variance).toBe(-40);
    expect(row.variancePercent).toBeCloseTo(-40);
  });

  it("leaves variance null while a position is still active", () => {
    const row = computePositionVariance(position({ status: "active", yieldEarned: 20 }));
    // An unmatured position must not read as underperformance.
    expect(row.variance).toBeNull();
    expect(row.variancePercent).toBeNull();
    expect(row.expectedYield).toBe(100);
  });

  it("treats a default as a realized shortfall", () => {
    const row = computePositionVariance(
      position({ status: "defaulted", expectedReturn: 1100, yieldEarned: 0 })
    );
    expect(row.variance).toBe(-100);
  });

  it("clamps a negative expected yield to zero", () => {
    const row = computePositionVariance(
      position({ investedAmount: 1000, expectedReturn: 900, status: "repaid" })
    );
    expect(row.expectedYield).toBe(0);
  });

  it("guards a zero expected yield against divide-by-zero", () => {
    const row = computePositionVariance(
      position({ investedAmount: 1000, expectedReturn: 1000, status: "repaid", yieldEarned: 5 })
    );
    expect(row.variance).toBe(5);
    expect(row.variancePercent).toBeNull();
  });

  it("coerces non-finite figures to zero", () => {
    const row = computePositionVariance(
      position({
        investedAmount: Number.NaN,
        expectedReturn: Number.POSITIVE_INFINITY,
        yieldEarned: Number.NaN,
        status: "repaid",
      })
    );
    expect(Number.isFinite(row.investedAmount)).toBe(true);
    expect(Number.isFinite(row.expectedYield)).toBe(true);
    expect(Number.isFinite(row.realizedYield)).toBe(true);
  });

  it("prefers the invoice number as the row label", () => {
    const row = computePositionVariance(
      position({
        invoice: { metadata: { invoiceNumber: "INV-042" } },
      } as Partial<InvestorPosition>)
    );
    expect(row.label).toBe("INV-042");
  });

  it("falls back to the invoice id when no number is present", () => {
    expect(computePositionVariance(position()).label).toBe("inv-1");
  });
});

describe("aggregateVariance", () => {
  it("counts only settled positions toward total variance", () => {
    const rows = computeVarianceRows([
      position({ id: "a", status: "repaid", expectedReturn: 1100, yieldEarned: 120 }),
      position({ id: "b", status: "active", expectedReturn: 1100, yieldEarned: 10 }),
    ]);

    const agg = aggregateVariance(rows);
    expect(agg.settledCount).toBe(1);
    expect(agg.pendingCount).toBe(1);
    expect(agg.totalVariance).toBe(20);
  });

  it("still counts active positions toward expected yield", () => {
    const rows = computeVarianceRows([
      position({ id: "a", status: "repaid", expectedReturn: 1100 }),
      position({ id: "b", status: "active", expectedReturn: 1100 }),
    ]);

    // The book's forward-looking expectation includes unmatured positions.
    expect(aggregateVariance(rows).totalExpectedYield).toBe(200);
  });

  it("tallies out- and under-performers", () => {
    const rows = computeVarianceRows([
      position({ id: "a", status: "repaid", expectedReturn: 1100, yieldEarned: 150 }),
      position({ id: "b", status: "repaid", expectedReturn: 1100, yieldEarned: 50 }),
      position({ id: "c", status: "repaid", expectedReturn: 1100, yieldEarned: 100 }),
    ]);

    const agg = aggregateVariance(rows);
    expect(agg.outperformingCount).toBe(1);
    expect(agg.underperformingCount).toBe(1);
    // The exactly-on-plan position counts as neither.
    expect(agg.settledCount).toBe(3);
  });

  it("computes aggregate variance percent against settled expectation only", () => {
    const rows = computeVarianceRows([
      position({ id: "a", status: "repaid", expectedReturn: 1100, yieldEarned: 150 }),
      position({ id: "b", status: "active", expectedReturn: 1100, yieldEarned: 0 }),
    ]);

    // 50 / 100 settled-expected = 50%, not 50 / 200.
    expect(aggregateVariance(rows).totalVariancePercent).toBeCloseTo(50);
  });

  it("returns null variance percent when nothing has settled", () => {
    const rows = computeVarianceRows([position({ status: "active" })]);
    expect(aggregateVariance(rows).totalVariancePercent).toBeNull();
  });

  it("handles an empty portfolio", () => {
    const agg = aggregateVariance([]);
    expect(agg.totalExpectedYield).toBe(0);
    expect(agg.settledCount).toBe(0);
    expect(agg.totalVariancePercent).toBeNull();
  });
});

describe("buildVarianceSeries", () => {
  it("buckets by month and sorts chronologically", () => {
    const rows = computeVarianceRows([
      position({ id: "a", investedAt: "2026-03-02T00:00:00.000Z", expectedReturn: 1100 }),
      position({ id: "b", investedAt: "2026-01-15T00:00:00.000Z", expectedReturn: 1100 }),
      position({ id: "c", investedAt: "2026-01-28T00:00:00.000Z", expectedReturn: 1100 }),
    ]);

    const series = buildVarianceSeries(rows);
    expect(series.map((p) => p.month)).toEqual(["2026-01", "2026-03"]);
    expect(series[0].expected).toBe(200);
  });

  it("carries variance per bucket", () => {
    const rows = computeVarianceRows([
      position({
        status: "repaid",
        investedAt: "2026-02-01T00:00:00.000Z",
        expectedReturn: 1100,
        yieldEarned: 130,
      }),
    ]);

    expect(buildVarianceSeries(rows)[0].variance).toBe(30);
  });

  it("skips rows with an unparseable date rather than bucketing them", () => {
    const rows = computeVarianceRows([
      position({ id: "a", investedAt: "not-a-date" }),
      position({ id: "b", investedAt: "2026-01-15T00:00:00.000Z" }),
    ]);

    const series = buildVarianceSeries(rows);
    expect(series).toHaveLength(1);
    expect(series[0].month).toBe("2026-01");
  });

  it("returns an empty series with no rows", () => {
    expect(buildVarianceSeries([])).toEqual([]);
  });
});

describe("varianceToExportRows", () => {
  it("exports blank variance for unsettled positions", () => {
    const rows = computeVarianceRows([position({ status: "active" })]);
    const exported = varianceToExportRows(rows);

    // A 0 here would be indistinguishable from "performed exactly to plan".
    expect(exported[0].Variance).toBe("");
    expect(exported[0]["Variance %"]).toBe("");
  });

  it("rounds monetary columns to two decimals", () => {
    const rows = computeVarianceRows([
      position({ status: "repaid", expectedReturn: 1100.129, yieldEarned: 99.456 }),
    ]);
    const exported = varianceToExportRows(rows);

    expect(exported[0]["Expected Yield"]).toBe(100.13);
    expect(exported[0]["Realized Yield"]).toBe(99.46);
  });

  it("uses the display label as the invoice id column", () => {
    const rows = computeVarianceRows([
      position({ invoice: { metadata: { invoiceNumber: "INV-9" } } } as Partial<InvestorPosition>),
    ]);
    expect(varianceToExportRows(rows)[0]["Invoice ID"]).toBe("INV-9");
  });
});

describe("varianceExportFilename", () => {
  it("is dated and CSV-suffixed", () => {
    expect(varianceExportFilename(new Date("2026-08-26T12:00:00Z"))).toBe(
      "kora-yield-variance-2026-08-26.csv"
    );
  });
});
