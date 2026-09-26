"use client";

/**
 * Realized vs expected yield variance (issue #601).
 *
 * Lives in its own component rather than inside `Charts.tsx`: that file is a
 * single monolithic default export whose props would have to grow to carry
 * position-level data, and this chart is also wanted on the investor dashboard
 * independently.
 *
 * All arithmetic is in `lib/yieldVariance` so it is unit-tested without
 * mounting recharts. This file only renders.
 */

import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormatters } from "@/hooks/useFormatters";
import {
  aggregateVariance,
  buildVarianceSeries,
  computeVarianceRows,
  varianceExportFilename,
  varianceToExportRows,
  VARIANCE_EXPORT_HEADERS,
} from "@/lib/yieldVariance";
import type { InvestorPosition } from "@/types/invoice";

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
    fontSize: "12px",
  },
};

export interface YieldVarianceChartProps {
  positions: InvestorPosition[];
  isLoading?: boolean;
  compact?: boolean;
  /** Receives export-ready rows; wire to the app's CSV writer. */
  onExport?: (
    rows: Array<Record<string, string | number>>,
    filename: string,
    headers: readonly string[]
  ) => void;
}

export default function YieldVarianceChart({
  positions,
  isLoading = false,
  compact = false,
  onExport,
}: YieldVarianceChartProps) {
  const t = useTranslations("analytics");
  const { formatCurrency, formatPercentage } = useFormatters();

  const rows = React.useMemo(() => computeVarianceRows(positions), [positions]);
  const series = React.useMemo(() => buildVarianceSeries(rows), [rows]);
  const totals = React.useMemo(() => aggregateVariance(rows), [rows]);

  const money = React.useCallback(
    (value: number) => formatCurrency(value, "USDC"),
    [formatCurrency]
  );

  /** Spell the series out for assistive tech, matching the other charts. */
  const description = React.useMemo(() => {
    if (series.length === 0) {
      return "Realized versus expected yield. No data available.";
    }
    const points = series
      .map(
        (point) =>
          `${point.month}: expected ${money(point.expected)}, realized ${money(point.realized)}`
      )
      .join("; ");
    return `Realized versus expected yield. ${series.length} months — ${points}.`;
  }, [series, money]);

  const handleExport = React.useCallback(() => {
    onExport?.(varianceToExportRows(rows), varianceExportFilename(), VARIANCE_EXPORT_HEADERS);
  }, [onExport, rows]);

  const varianceIsPositive = totals.totalVariance >= 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Realized vs Expected Yield</CardTitle>
        {onExport && rows.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md p-2 transition-colors hover:bg-muted"
            aria-label={t("a11y.exportVariance")}
          >
            <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div style={{ height: compact ? 180 : 240 }}>
            <Skeleton className="h-full w-full" />
          </div>
        ) : series.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No yield data yet</p>
          </div>
        ) : (
          <>
            <div role="img" aria-label={description}>
              <ResponsiveContainer width="100%" height={compact ? 180 : 240}>
                <ComposedChart
                  data={series}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  accessibilityLayer
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => money(v)}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => [money(value), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="expected"
                    name="Expected"
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.35}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={!isLoading}
                  />
                  <Line
                    type="monotone"
                    dataKey="realized"
                    name="Realized"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={!isLoading}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Aggregate readout */}
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Expected</dt>
                <dd className="text-sm font-medium">{money(totals.totalExpectedYield)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Realized</dt>
                <dd className="text-sm font-medium">{money(totals.totalRealizedYield)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Variance</dt>
                <dd
                  className={`flex items-center gap-1 text-sm font-medium ${
                    varianceIsPositive ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {varianceIsPositive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {money(totals.totalVariance)}
                  {totals.totalVariancePercent !== null && (
                    <span className="text-xs">
                      ({formatPercentage(totals.totalVariancePercent, 1)})
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Settled</dt>
                <dd className="text-sm font-medium">
                  {totals.settledCount} / {totals.settledCount + totals.pendingCount}
                </dd>
              </div>
            </dl>

            {totals.pendingCount > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {totals.pendingCount} position
                {totals.pendingCount === 1 ? " is" : "s are"} still active and counted as expected
                only — variance is reported for settled positions.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
