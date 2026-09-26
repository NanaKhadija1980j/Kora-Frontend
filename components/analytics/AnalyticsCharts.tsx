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

function EmptyState({ message = "No data available" }: { message?: string }) {
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
              <EmptyState message="No portfolio data yet" />
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
                      reversed={rtl}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      orientation={rtl ? "right" : "left"}
                      tickFormatter={(v: number) =>
                        `${formatNumber(v / 1000, { maximumFractionDigits: 0 })}K`
                      }
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [formatCurrency(v, "USDC"), "Value"]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#portfolioGrad)"
                      isAnimationActive={!isLoading}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFigure>
            )}
          </CardContent>
        </Card>

        {/* Monthly Yield */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Monthly Yield Earned</CardTitle>
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
              <EmptyState message="No yield data yet" />
            ) : (
              <ChartFigure
                label={describeSeries("Monthly yield earned", yieldData, "month", "yield", (v) =>
                  formatCurrency(v, "USDC")
                )}
              >
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
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
                      tickFormatter={(v: number) =>
                        `${formatNumber(v / 1000, { maximumFractionDigits: 0 })}K`
                      }
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [formatCurrency(v, "USDC"), "Yield"]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Bar
                      dataKey="yield"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!isLoading}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFigure>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution & Return Rate Row */}
      <div className="grid gap-6 lg:grid-cols-3">
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
              <ChartSkeleton height={compact ? 140 : 180} />
            ) : risk.length === 0 ? (
              <EmptyState message="No risk data yet" />
            ) : (
              <>
                <ChartFigure
                  label={describeDistribution("Risk distribution across portfolio", risk)}
                >
                  <ResponsiveContainer width="100%" height={compact ? 140 : 180}>
                    <PieChart>
                      <Pie
                        data={risk}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={compact ? 60 : 70}
                        paddingAngle={2}
                        dataKey="value"
                        isAnimationActive={!isLoading}
                        style={{
                          cursor: onRiskSegmentClick ? "pointer" : "default",
                        }}
                        onClick={(_, index) => {
                          const point = risk[index];
                          if (point && onRiskSegmentClick) {
                            onRiskSegmentClick(point.name);
                          }
                        }}
                      >
                        {risk.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v: number) => [`${v}%`, "Allocation"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartFigure>
                {/* Keyboard-operable equivalent of the pie segments: the same
                    drill-down the chart offers via mouse, as real buttons. */}
                <div className="mt-4 space-y-1.5">
                  {risk.map((d) => (
                    <button
                      key={d.name}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
                      onClick={() => onRiskSegmentClick?.(d.name)}
                      disabled={!onRiskSegmentClick}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="font-medium text-foreground">{d.value}%</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Monthly Return Rate */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Monthly Return Rate</CardTitle>
            {onExport && (
              <button
                type="button"
                onClick={() => onExport("monthly")}
                className="rounded-md p-2 transition-colors hover:bg-muted"
                aria-label={t("a11y.exportReturn")}
              >
                <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton height={chartHeight} />
            ) : monthly.length === 0 ? (
              <EmptyState message="No return data yet" />
            ) : (
              <ChartFigure
                label={describeSeries("Monthly return rate", monthly, "month", "return", (v) =>
                  formatPercentage(v, 2)
                )}
              >
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <LineChart
                    data={monthly}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    accessibilityLayer
                  >
                    <defs>
                      <linearGradient id="returnGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
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
                      tickFormatter={(v: number) => formatPercentage(v, 1)}
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(v: number) => [formatPercentage(v, 2), "Return"]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="return"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", r: 4 }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={!isLoading}
                    />
                    {/*
                    Benchmark overlays (#603). Dashed and colour-shifted so they
                    read as reference lines rather than another data series.
                  */}
                    {benchmarks.benchmarks.map((benchmark) => (
                      <ReferenceLine
                        key={benchmark.id}
                        y={benchmark.apr}
                        stroke={benchmark.color}
                        strokeDasharray={benchmark.dash}
                        strokeWidth={1.5}
                        ifOverflow="extendDomain"
                        label={{
                          value: benchmark.defaultLabel,
                          position: "insideTopRight",
                          fill: benchmark.color,
                          fontSize: 10,
                        }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartFigure>
            )}
            {benchmarks.enabled && (
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {BENCHMARK_DISCLOSURE}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Allocation treemap (#600) ───────────────────────────────────── */}
      {positions && (
        <div className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Allocation by Risk &amp; Jurisdiction</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ChartSkeleton height={chartHeight} />
              ) : treemap.groups.length === 0 ? (
                <EmptyState message="No allocation data yet" />
              ) : (
                <>
                  <ChartFigure label={describeTreemap(treemap, (v) => formatCurrency(v, "USDC"))}>
                    <ResponsiveContainer width="100%" height={compact ? 220 : 300}>
                      <Treemap
                        data={treemapSeries}
                        dataKey="size"
                        nameKey="name"
                        stroke="hsl(var(--background))"
                        isAnimationActive={!isLoading}
                        content={<TreemapCell />}
                      >
                        <Tooltip
                          {...TOOLTIP_STYLE}
                          formatter={(value: number) => [formatCurrency(value, "USDC"), "Invested"]}
                        />
                      </Treemap>
                    </ResponsiveContainer>
                  </ChartFigure>
                  {concentration && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Largest concentration:{" "}
                      <span className="font-medium text-foreground">
                        {concentration.group} / {concentration.leaf}
                      </span>{" "}
                      ({formatPercentage(concentration.percentOfTotal, 1)} of portfolio)
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Treemap cell renderer.
 *
 * recharts' default cell has no fill control per node and clips its label at
 * any size. This paints the palette colour from the series and only draws the
 * label when the rectangle is actually big enough to hold it — an unreadable
 * sliver of text is worse than none, and the full breakdown is already in the
 * `role="img"` description.
 */
function TreemapCell(props: Record<string, unknown> = {}) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const height = Number(props.height ?? 0);
  const name = String(props.name ?? "");
  const color = typeof props.color === "string" ? props.color : "#94a3b8";
  const depth = Number(props.depth ?? 0);

  const showLabel = width > 48 && height > 24;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          // Parent rectangles sit behind their children; keeping them
          // transparent avoids washing out the leaf colours.
          fillOpacity: depth === 1 ? 0 : 0.85,
          stroke: "hsl(var(--background))",
          strokeWidth: 2,
        }}
      />
      {showLabel && depth > 1 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0b1220"
          fontSize={11}
          fontWeight={600}
          pointerEvents="none"
        >
          {name}
        </text>
      )}
    </g>
  );
}
