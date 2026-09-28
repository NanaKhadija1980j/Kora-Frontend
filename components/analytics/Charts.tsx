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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ChartTooltip from "@/components/analytics/ChartTooltip";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { PieChart as PieChartIcon } from "lucide-react";

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "8px",
    color: "#e4e4e7",
    fontSize: "12px",
  },
};

type MonthValuePoint = {
  month: string;
  value: number;
};

type MonthYieldPoint = {
  month: string;
  yield: number;
};

type RiskPoint = {
  name: string;
  value: number;
  color: string;
};

type MonthReturnPoint = {
  month: string;
  return: number;
};

interface ChartsProps {
  portfolio: MonthValuePoint[];
  yieldData: MonthYieldPoint[];
  risk: RiskPoint[];
  monthly: MonthReturnPoint[];
  compact?: boolean;
  /** Called when a risk-distribution segment is clicked (marketplace drill-down). */
  onRiskSegmentClick?: (riskTier: string) => void;
}

export default function Charts({
  portfolio,
  yieldData,
  risk,
  monthly,
  compact = false,
  onRiskSegmentClick,
}: ChartsProps) {
  const { isMobile, isTablet } = useBreakpoint();

  const chartHeight = compact ? 180 : isMobile ? 200 : isTablet ? 220 : 240;
  const fontSize = isMobile ? 10 : 11;

  return (
    <>
      <div
        className={`mb-6 grid gap-6 ${isMobile ? "grid-cols-1" : "lg:grid-cols-2"}`}
      >
        <div>
          <Card>
            <CardHeader>
              <CardTitle className={isMobile ? "text-sm" : "text-base"}>
                Portfolio Growth (USDC)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart data={portfolio}>
                  <defs>
                    <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#71717a", fontSize }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    content={<ChartTooltip unit="USDC" />}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Portfolio"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    fill="url(#portfolioGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className={isMobile ? "text-sm" : "text-base"}>
                Monthly Yield Earned (USDC)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={yieldData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#71717a", fontSize }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    content={<ChartTooltip unit="USDC" />}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Yield"]}
                  />
                  <Bar dataKey="yield" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <div
        className={`grid gap-6 ${isMobile ? "grid-cols-1" : "lg:grid-cols-3"}`}
      >
        <div>
          <Card>
            <CardHeader>
              <CardTitle className={isMobile ? "text-sm" : "text-base"}>
                Risk Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {risk.length === 0 ? (
                <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
                  <PieChartIcon className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">
                    No positions to allocate yet
                  </p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer
                    width="100%"
                    height={compact ? 140 : isMobile ? 160 : 180}
                  >
                    <PieChart>
                      <Pie
                        data={risk}
                        cx="50%"
                        cy="50%"
                        innerRadius={isMobile ? 40 : 50}
                        outerRadius={compact ? 60 : isMobile ? 65 : 75}
                        paddingAngle={3}
                        dataKey="value"
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
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        content={<ChartTooltip unit="" />}
                        formatter={(v: number) => [`${v}%`, "Allocation"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div
                    className={`mt-2 grid gap-2 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}
                  >
                    {risk.map((d) => (
                      <button
                        key={d.name}
                        type="button"
                        className="flex items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs transition-colors hover:bg-muted/60"
                        onClick={() => onRiskSegmentClick?.(d.name)}
                        disabled={!onRiskSegmentClick}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="text-zinc-400">{d.name}</span>
                        <span className="ml-auto text-zinc-300">{d.value}%</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className={isMobile ? "text-sm" : "text-base"}>
                Monthly Return Rate (%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="returnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#71717a", fontSize }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    content={<ChartTooltip unit="" />}
                    formatter={(v: number) => [`${v}%`, "Return"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="return"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fill="url(#returnGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

// ─── Marketplace Distribution Widgets (#561) ──────────────────────────────────

const RISK_TIER_COLORS: Record<string, string> = {
  AAA: "#10b981", // emerald
  AA: "#34d399",
  A: "#6EE7B7",
  BBB: "#f59e0b", // amber
  BB: "#fbbf24",
  B: "#f97316",  // orange
  CCC: "#ef4444", // red
};

interface MarketplaceAprHistogramProps {
  invoices: Array<{ terms: { apr: number } }>;
}

export function MarketplaceAprHistogram({ invoices }: MarketplaceAprHistogramProps) {
  const buckets = React.useMemo(() => {
    const counts = { "0-10%": 0, "10-20%": 0, "20-30%": 0, "30-40%": 0, "40-50%": 0 };
    invoices.forEach((inv) => {
      const apr = inv.terms.apr;
      if (apr < 10) counts["0-10%"]++;
      else if (apr < 20) counts["10-20%"]++;
      else if (apr < 30) counts["20-30%"]++;
      else if (apr < 40) counts["30-40%"]++;
      else counts["40-50%"]++;
    });
    return Object.entries(counts).map(([range, count]) => ({
      range,
      count,
    }));
  }, [invoices]);

  if (invoices.length === 0) {
    return (
      <div className="flex h-36 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-800 p-4 text-center">
        <p className="text-xs font-medium text-zinc-500">No APR distribution data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-label="APR Distribution Histogram">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="font-semibold text-zinc-300">APR Yield Ranges</span>
        <span className="font-mono text-[11px] text-zinc-500">{invoices.length} invoices</span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={buckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="range" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            {...TOOLTIP_STYLE}
            content={<ChartTooltip unit="invoices" />}
            formatter={(v: number) => [`${v}`, "Invoices"]}
          />
          <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MarketplaceRiskDistributionProps {
  invoices: Array<{ riskTier: string }>;
  onRiskSegmentClick?: (riskTier: string) => void;
  selectedRiskTiers?: string[];
}

export function MarketplaceRiskDistribution({
  invoices,
  onRiskSegmentClick,
  selectedRiskTiers = [],
}: MarketplaceRiskDistributionProps) {
  const riskData = React.useMemo(() => {
    if (invoices.length === 0) return [];
    const counts: Record<string, number> = {};
    invoices.forEach((inv) => {
      counts[inv.riskTier] = (counts[inv.riskTier] || 0) + 1;
    });

    return Object.entries(counts).map(([tier, count]) => ({
      name: tier,
      value: Math.round((count / invoices.length) * 100),
      count,
      color: RISK_TIER_COLORS[tier] || "#9ca3af",
    }));
  }, [invoices]);

  if (invoices.length === 0) {
    return (
      <div className="flex h-36 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-800 p-4 text-center">
        <p className="text-xs font-medium text-zinc-500">No Risk Tier data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-label="Risk Tier Distribution">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="font-semibold text-zinc-300">Risk Tier Allocation</span>
        <span className="font-mono text-[11px] text-zinc-500">Click to filter</span>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {riskData.map((item) => {
          const isSelected = selectedRiskTiers.includes(item.name);
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onRiskSegmentClick?.(item.name)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-all ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50"
              }`}
              title={`Filter by Risk Tier ${item.name}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.name}</span>
              <span className="font-mono text-[10px] text-zinc-400">({item.count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

