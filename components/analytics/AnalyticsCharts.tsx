"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Treemap,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/hooks/useFormatters";
import { useLocale } from "@/i18n/LocaleProvider";
import { isRTL } from "@/i18n/config";
import {
  buildTreemapModel,
  describeTreemap,
  largestConcentration,
  toTreemapSeries,
} from "@/lib/portfolioTreemap";
import type {
  AllocatablePosition,
  MonthlyReturnPoint,
  PortfolioValuePoint,
  YieldPoint,
} from "@/lib/portfolioAllocation";
import { BENCHMARK_DISCLOSURE, getBenchmarkConfig, type BenchmarkConfig } from "@/lib/benchmarks";

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
    fontSize: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  },
  cursor: { fill: "hsl(var(--muted))" },
};

interface AnalyticsChartsProps {
  portfolio: PortfolioValuePoint[];
  yieldData: YieldPoint[];
  risk: Array<{ name: string; value: number; color: string }>;
  monthly: MonthlyReturnPoint[];
  isLoading?: boolean;
  compact?: boolean;
  onExport?: (type: "portfolio" | "yield" | "risk" | "monthly") => void;
  /** Drill-down: open marketplace filtered by the selected risk tier. */
  onRiskSegmentClick?: (riskTier: string) => void;
  /**
   * Live positions for the allocation treemap (#600). Omit to hide the card —
   * the treemap needs per-position metadata the aggregated `risk` prop has
   * already collapsed away.
   */
  positions?: AllocatablePosition[];
  /**
   * Benchmark overlay config (#603). Defaults to the env-derived config;
   * injectable so stories and tests are not coupled to build-time env vars.
   */
  benchmarkConfig?: BenchmarkConfig;
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center">
      <Skeleton className="h-full w-full" />
    </div>
  );
}

// ─── Accessibility (Issue #439) ──────────────────────────────────────────────
//
// Recharts renders each chart as an unlabelled <svg>. To a screen reader that
// is an anonymous graphic: the visible CardTitle sits outside the SVG and is
// never associated with it, so axe reports the chart as content with no
// accessible name and a non-sighted user gets nothing at all from it.
//
// Each chart is therefore wrapped in a `role="img"` element carrying an
// aria-label that spells out the underlying numbers. `role="img"` collapses the
// SVG's internals — hundreds of <path>/<g> nodes that are meaningless read
// aloud — into a single labelled node, which is the WAI-ARIA recommended
// pattern for a data graphic with a text alternative.

/** Render a time series as a sentence: title, point count, then every value. */
function describeSeries<T extends object>(
  title: string,
  rows: T[],
  labelKey: keyof T,
  valueKey: keyof T,
  format: (value: number) => string
): string {
  if (rows.length === 0) return `${title}. No data available.`;
  const points = rows
    .map((row) => `${String(row[labelKey])}: ${format(Number(row[valueKey]))}`)
    .join("; ");
  return `${title}. ${rows.length} data points — ${points}.`;
}

/** Render a proportional breakdown as a sentence. */
function describeDistribution(
  title: string,
  slices: Array<{ name: string; value: number }>
): string {
  if (slices.length === 0) return `${title}. No data available.`;
  const segments = slices.map((s) => `${s.name}: ${s.value}%`).join("; ");
  return `${title}. ${slices.length} segments — ${segments}.`;
}

/**
 * Wraps a chart in a single labelled node so assistive tech announces the
 * summary instead of walking the SVG's internals.
 */
function ChartFigure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={label}>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
      <TrendingUp className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function AnalyticsCharts({
  portfolio,
  yieldData,
  risk,
  monthly,
  isLoading = false,
  compact = false,
  onExport,
  onRiskSegmentClick,
  positions,
  benchmarkConfig,
}: AnalyticsChartsProps) {
  const chartHeight = compact ? 180 : 240;
  const t = useTranslations("analytics");
  const locale = useLocale();
  const rtl = isRTL(locale);
  const { formatCurrency, formatNumber, formatPercentage } = useFormatters();

  // Recomputed only when the positions change: the nesting walks every
  // position twice and the analytics page re-renders on every filter tick.
  const treemap = React.useMemo(() => buildTreemapModel(positions ?? []), [positions]);
  const treemapSeries = React.useMemo(() => toTreemapSeries(treemap), [treemap]);
  const concentration = React.useMemo(() => largestConcentration(treemap), [treemap]);

  const benchmarks = React.useMemo(
    () => benchmarkConfig ?? getBenchmarkConfig(),
    [benchmarkConfig]
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Portfolio Growth & Yield Row */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Portfolio Growth */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Portfolio Growth</CardTitle>
            {onExport && (
              <button
                type="button"
                onClick={() => onExport("portfolio")}
                className="rounded-md p-2 transition-colors hover:bg-muted"
                aria-label={t("a11y.exportPortfolio")}
              >
                <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : portfolio.length === 0 ? (
              <EmptyState message={t("charts.empty.portfolio")} />
            ) : (
              <ChartFigure
                label={describeSeries(
                  "Portfolio growth over time",
                  portfolio,
                  "month",
                  "value",
                  (v) => formatCurrency(v, "USDC")
                )}
              >
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <AreaChart
                    data={portfolio}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    accessibilityLayer
                  >
                    <defs>
                      <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
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
                      tickFormatter={(v) => formatCurrency(v, "USDC")}
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [formatCurrency(v, "USDC"), "Value"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="url(#portfolioGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFigure>
            )}
          </CardContent>
        </Card>

        {/* Yield */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Yield Over Time</CardTitle>
            {onExport && (
              <button
                type="button"
                onClick={() => onExport("yield")}
                className="rounded-md p-2 transition-colors hover:bg-muted"
                aria-label={t("a11y.exportYield")}
              >
                <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : yieldData.length === 0 ? (
              <EmptyState message={t("charts.empty.yield")} />
            ) : (
              <ChartFigure
                label={describeSeries(
                  "Yield over time",
                  yieldData,
                  "month",
                  "yield",
                  (v) => formatPercentage(v)
                )}
              >
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <LineChart
                    data={yieldData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
                      tickFormatter={(v) => formatPercentage(v)}
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [formatPercentage(v), "Yield"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="yield"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartFigure>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk & Monthly Returns Row */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Risk Distribution */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Risk Distribution</CardTitle>
            {onExport && (
              <button
                type="button"
                onClick={() => onExport("risk")}
                className="rounded-md p-2 transition-colors hover:bg-muted"
                aria-label={t("a11y.exportRisk")}
              >
                <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : risk.length === 0 ? (
              <EmptyState message={t("charts.empty.risk")} />
            ) : (
              <ChartFigure label={describeDistribution("Risk distribution", risk)}>
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <PieChart accessibilityLayer>
                    <Pie
                      data={risk}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}%`}
                      onClick={(entry) => onRiskSegmentClick?.(entry.name)}
                      style={{ cursor: onRiskSegmentClick ? "pointer" : "default" }}
                    >
                      {risk.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Allocation"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartFigure>
            )}
          </CardContent>
        </Card>

        {/* Monthly Returns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Monthly Returns</CardTitle>
            {onExport && (
              <button
                type="button"
                onClick={() => onExport("monthly")}
                className="rounded-md p-2 transition-colors hover:bg-muted"
                aria-label={t("a11y.exportMonthly")}
              >
                <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : monthly.length === 0 ? (
              <EmptyState message={t("charts.empty.monthly")} />
            ) : (
              <ChartFigure
                label={describeSeries(
                  "Monthly returns",
                  monthly,
                  "month",
                  "return",
                  (v) => formatPercentage(v)
                )}
              >
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
                    data={monthly}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
                      tickFormatter={(v) => formatPercentage(v)}
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [formatPercentage(v), "Return"]}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="return" radius={[4, 4, 0, 0]}>
                      {monthly.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.return >= 0
                              ? "hsl(var(--primary))"
                              : "hsl(var(--destructive))"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartFigure>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Allocation Treemap (#600) */}
      {positions && positions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Allocation Treemap</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : treemapSeries.length === 0 ? (
              <EmptyState message={t("charts.empty.allocation")} />
            ) : (
              <ChartFigure label={describeTreemap(treemap)}>
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <Treemap
                    data={treemapSeries}
                    dataKey="size"
                    stroke="hsl(var(--background))"
                    fill="hsl(var(--primary))"
                    aspectRatio={4 / 3}
                  >
                    {treemapSeries.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Treemap>
                </ResponsiveContainer>
              </ChartFigure>
            )}
            {concentration !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("treemap.concentration", { percent: formatPercentage(concentration) })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Benchmark Comparison (#603) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Benchmark Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartSkeleton height={chartHeight} />
          ) : portfolio.length === 0 ? (
            <EmptyState message={t("charts.empty.benchmark")} />
          ) : (
            <ChartFigure
              label={describeSeries(
                "Benchmark comparison",
                portfolio,
                "month",
                "value",
                (v) => formatCurrency(v, "USDC")
              )}
            >
              <ResponsiveContainer width="100%" height={chartHeight}>
                <ComposedChart
                  data={portfolio}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
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
                    tickFormatter={(v) => formatCurrency(v, "USDC")}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [formatCurrency(v, "USDC"), "Value"]}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Portfolio"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey={benchmarks.primary.key}
                    name={benchmarks.primary.label}
                    stroke={benchmarks.primary.color}
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartFigure>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{BENCHMARK_DISCLOSURE}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
