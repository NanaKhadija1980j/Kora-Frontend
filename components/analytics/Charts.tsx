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
