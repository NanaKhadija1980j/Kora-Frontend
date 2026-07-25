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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Download, TrendingUp, TrendingDown } from "lucide-react";

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
  portfolio: Array<{ month: string; value: number }>;
  yieldData: Array<{ month: string; yield: number }>;
  risk: Array<{ name: string; value: number; color: string }>;
  monthly: Array<{ month: string; return: number }>;
  isLoading?: boolean;
  compact?: boolean;
  onExport?: (type: "portfolio" | "yield" | "risk" | "monthly") => void;
  /** Drill-down: open marketplace filtered by the selected risk tier. */
  onRiskSegmentClick?: (riskTier: string) => void;
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center">
      <Skeleton className="h-full w-full" />
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
}: AnalyticsChartsProps) {
  const chartHeight = compact ? 180 : 240;

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
                className="rounded-md p-2 hover:bg-muted transition-colors"
                aria-label="Export portfolio data"
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
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart data={portfolio} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Value"]}
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
                className="rounded-md p-2 hover:bg-muted transition-colors"
                aria-label="Export yield data"
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
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={yieldData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Yield"]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Bar dataKey="yield" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} isAnimationActive={!isLoading} />
                </BarChart>
              </ResponsiveContainer>
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
                className="rounded-md p-2 hover:bg-muted transition-colors"
                aria-label="Export risk data"
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
                className="rounded-md p-2 hover:bg-muted transition-colors"
                aria-label="Export return data"
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
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={monthly} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [`${v.toFixed(2)}%`, "Return"]}
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
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
