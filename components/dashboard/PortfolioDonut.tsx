"use client";

/**
 * PortfolioDonut — interactive portfolio composition visualization from live positions.
 *
 * Three donut charts:
 *   1. By Risk Tier
 *   2. By Jurisdiction
 *   3. By Category
 *
 * Clicking a segment drills into the marketplace with matching filters via
 * `onSegmentClick`. Empty state shown when the investor has no positions.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PieChart as PieChartIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/hooks/useFormatters";
import {
  aggregatePositions,
  type AllocatablePosition,
  type AllocationDimension,
  type AllocationFilter,
  type AllocationSlice,
} from "@/lib/portfolioAllocation";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DonutDimension = AllocationDimension;
export type DonutFilter = AllocationFilter;

export interface PortfolioDonutProps {
  /** Live investor positions to visualise */
  positions: AllocatablePosition[];
  /** Currently active drill-down filter (controlled from parent) */
  activeFilter: DonutFilter | null;
  /** Called when the user clicks a segment (parent navigates to marketplace) */
  onSegmentClick: (filter: DonutFilter | null) => void;
}

function useDimensionLabels(): Record<DonutDimension, string> {
  const t = useTranslations("portfolioDonut");
  return {
    riskTier: t("dimensions.riskTier"),
    jurisdiction: t("dimensions.jurisdiction"),
    category: t("dimensions.category"),
  };
}

// ─── Custom active shape (highlighted segment) ───────────────────────────────

function ActiveShape(props: {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
  payload?: AllocationSlice;
  percent?: number;
}) {
  const { formatPercentage } = useFormatters();
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill,
    payload,
    percent = 0,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={1}
      />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fill="#e4e4e7"
        fontSize={13}
        fontWeight={700}
      >
        {payload?.name}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fill="#14b8a6"
        fontSize={12}
        fontWeight={600}
      >
        {formatPercentage(percent * 100, 1)}
      </text>
    </g>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AllocationSlice }>;
}) {
  const { formatCurrency, formatPercentage } = useFormatters();
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0].payload;
  return (
    <div
      style={{
        background: "rgba(24,24,27,0.95)",
        border: "1px solid #27272a",
        borderRadius: 8,
        padding: "8px 12px",
        color: "#e4e4e7",
        fontSize: 12,
        minWidth: 160,
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: 4, color: "#f4f4f5" }}>{name}</p>
      <p style={{ color: "#14b8a6", fontWeight: 600 }}>
        {formatCurrency(value, "USDC", true)}
      </p>
      <p style={{ color: "#71717a" }}>{formatPercentage(percent * 100, 1)} of portfolio</p>
      <p style={{ color: "#a1a1aa", marginTop: 4 }}>Click to browse marketplace</p>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

interface LegendProps {
  slices: AllocationSlice[];
  dimension: DonutDimension;
  activeValue: string | null;
  onItemClick: (value: string) => void;
}

function DonutLegend({ slices, dimension, activeValue, onItemClick }: LegendProps) {
  const t = useTranslations("portfolioDonut");
  const dimensionLabels = useDimensionLabels();
  const { formatCurrency, formatPercentage } = useFormatters();
  if (slices.length === 0) return null;
  return (
    <ul
      className="mt-3 w-full space-y-1.5"
      role="list"
      aria-label={t("legendAria", { dimension: dimensionLabels[dimension] })}
    >
      {slices.map((slice) => {
        const isActive = activeValue === slice.name;
        return (
          <li key={slice.name}>
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors",
                "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive ? "bg-muted/80 ring-1 ring-ring" : "bg-transparent"
              )}
              onClick={() => onItemClick(slice.name)}
              aria-pressed={isActive}
              aria-label={t("legendItemAria", {
                name: slice.name,
                percent: formatPercentage(slice.percent * 100, 1),
              })}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span
                  className={cn(
                    "truncate",
                    isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {slice.name}
                </span>
              </span>
              <span className="flex flex-shrink-0 items-center gap-2 tabular-nums">
                <span className="text-muted-foreground">
                  {formatCurrency(slice.value, "USDC", true)}
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                >
                  {formatPercentage(slice.percent * 100, 1)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Single donut panel ───────────────────────────────────────────────────────

interface DonutPanelProps {
  title: string;
  slices: AllocationSlice[];
  dimension: DonutDimension;
  activeFilter: DonutFilter | null;
  onSegmentClick: (filter: DonutFilter | null) => void;
}

function DonutPanel({
  title,
  slices,
  dimension,
  activeFilter,
  onSegmentClick,
}: DonutPanelProps) {
  const t = useTranslations("portfolioDonut");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const activeValue =
    activeFilter?.dimension === dimension ? activeFilter.value : null;

  const handleClick = useCallback(
    (data: AllocationSlice) => {
      if (
        activeFilter?.dimension === dimension &&
        activeFilter.value === data.name
      ) {
        onSegmentClick(null);
      } else {
        onSegmentClick({ dimension, value: data.name });
      }
    },
    [activeFilter, dimension, onSegmentClick]
  );

  const handleLegendClick = useCallback(
    (value: string) => {
      if (activeFilter?.dimension === dimension && activeFilter.value === value) {
        onSegmentClick(null);
      } else {
        onSegmentClick({ dimension, value });
      }
    },
    [activeFilter, dimension, onSegmentClick]
  );

  const cellOpacity = (name: string) => {
    if (!activeValue) return 1;
    return name === activeValue ? 1 : 0.3;
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center gap-0 pt-0">
        {slices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <PieChartIcon className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No data</p>
          </div>
        ) : (
          <>
            <div className="w-full" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    activeIndex={hoverIndex ?? undefined}
                    activeShape={ActiveShape}
                    onMouseEnter={(_, index) => setHoverIndex(index)}
                    onMouseLeave={() => setHoverIndex(null)}
                    onClick={(_, index) => {
                      const slice = slices[index];
                      if (slice) handleClick(slice);
                    }}
                    style={{ cursor: "pointer" }}
                    aria-label={t("chartAria", { title })}
                  >
                    {slices.map((slice) => (
                      <Cell
                        key={slice.name}
                        fill={slice.color}
                        opacity={cellOpacity(slice.name)}
                        stroke={
                          activeValue === slice.name ? slice.color : "transparent"
                        }
                        strokeWidth={activeValue === slice.name ? 2 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <DonutLegend
              slices={slices}
              dimension={dimension}
              activeValue={activeValue}
              onItemClick={handleLegendClick}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <PieChartIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          No portfolio data yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fund invoices on the marketplace to see your portfolio composition.
        </p>
      </div>
    </div>
  );
}

// ─── Active filter badge ──────────────────────────────────────────────────────

interface FilterBadgeProps {
  filter: DonutFilter;
  onClear: () => void;
}

function ActiveFilterBadge({ filter, onClear }: FilterBadgeProps) {
  const t = useTranslations("portfolioDonut");
  const labels = useDimensionLabels();
  return (
    <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
      <span>
        {t.rich("filteringBy", {
          dimension: labels[filter.dimension],
          value: filter.value,
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="ml-1 rounded-full p-0.5 transition-colors hover:bg-primary/20"
        aria-label={t("clearFilter")}
      >
        ×
      </button>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PortfolioDonut({
  positions,
  activeFilter,
  onSegmentClick,
}: PortfolioDonutProps) {
  const t = useTranslations("portfolioDonut");
  const riskSlices = useMemo(
    () => aggregatePositions(positions, "riskTier"),
    [positions]
  );
  const jurisdictionSlices = useMemo(
    () => aggregatePositions(positions, "jurisdiction"),
    [positions]
  );
  const categorySlices = useMemo(
    () => aggregatePositions(positions, "category"),
    [positions]
  );

  const hasPositions = positions.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            Click a segment to browse matching invoices on the marketplace
          </p>
        </div>
        {activeFilter && (
          <ActiveFilterBadge
            filter={activeFilter}
            onClear={() => onSegmentClick(null)}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hasPositions ? (
          <>
            <DonutPanel
              title={t("byRiskTier")}
              slices={riskSlices}
              dimension="riskTier"
              activeFilter={activeFilter}
              onSegmentClick={onSegmentClick}
            />
            <DonutPanel
              title={t("byJurisdiction")}
              slices={jurisdictionSlices}
              dimension="jurisdiction"
              activeFilter={activeFilter}
              onSegmentClick={onSegmentClick}
            />
            <DonutPanel
              title={t("byCategory")}
              slices={categorySlices}
              dimension="category"
              activeFilter={activeFilter}
              onSegmentClick={onSegmentClick}
            />
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
