"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DateRangePicker, type PresetRange, type DateRange } from "./DateRangePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskTierFilter = "all" | "AAA" | "AA" | "A" | "BBB" | "BB" | "B";
export type JurisdictionFilter = "all" | "NG" | "KE" | "GH" | "ZA" | "IN" | "BR";
export type CategoryFilter = "all" | "trade" | "services" | "manufacturing" | "retail";

export interface AnalyticsFilters {
  riskTier: RiskTierFilter;
  jurisdiction: JurisdictionFilter;
  category: CategoryFilter;
  dateRange: PresetRange | "custom";
  customDateRange?: DateRange;
}

export const DEFAULT_FILTERS: AnalyticsFilters = {
  riskTier: "all",
  jurisdiction: "all",
  category: "all",
  dateRange: "30d",
};

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
  className?: string;
}

const RISK_TIERS: { label: string; value: RiskTierFilter }[] = [
  { label: "All", value: "all" },
  { label: "AAA", value: "AAA" },
  { label: "AA", value: "AA" },
  { label: "A", value: "A" },
  { label: "BBB", value: "BBB" },
  { label: "BB", value: "BB" },
  { label: "B", value: "B" },
];

const JURISDICTIONS: { label: string; value: JurisdictionFilter }[] = [
  { label: "All Regions", value: "all" },
  { label: "Nigeria", value: "NG" },
  { label: "Kenya", value: "KE" },
  { label: "Ghana", value: "GH" },
  { label: "South Africa", value: "ZA" },
  { label: "India", value: "IN" },
  { label: "Brazil", value: "BR" },
];

const CATEGORIES: { label: string; value: CategoryFilter }[] = [
  { label: "All Categories", value: "all" },
  { label: "Trade", value: "trade" },
  { label: "Services", value: "services" },
  { label: "Manufacturing", value: "manufacturing" },
  { label: "Retail", value: "retail" },
];

// ─── Active filter summary ────────────────────────────────────────────────────

function buildSummary(filters: AnalyticsFilters): string {
  const parts: string[] = [];

  if (filters.riskTier !== "all") parts.push(`Risk ${filters.riskTier}`);
  if (filters.jurisdiction !== "all") {
    const j = JURISDICTIONS.find((j) => j.value === filters.jurisdiction);
    if (j) parts.push(j.label);
  }
  if (filters.category !== "all") {
    const c = CATEGORIES.find((c) => c.value === filters.category);
    if (c) parts.push(c.label);
  }

  const rangeLabel =
    filters.dateRange === "custom"
      ? "custom range"
      : filters.dateRange === "ytd"
        ? "year to date"
        : `last ${filters.dateRange}`;
  parts.push(rangeLabel);

  return `Showing data for: ${parts.join(", ")}`;
}

function hasActiveFilters(filters: AnalyticsFilters): boolean {
  return (
    filters.riskTier !== "all" ||
    filters.jurisdiction !== "all" ||
    filters.category !== "all" ||
    filters.dateRange !== "30d"
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AnalyticsFilterBar — filter bar for the analytics page.
 * Renders risk tier chips, jurisdiction dropdown, category dropdown,
 * and a date range picker. Calls onChange on every filter change.
 */
export function AnalyticsFilterBar({ filters, onChange, className }: AnalyticsFilterBarProps) {
  const t = useTranslations("analytics");
  const update = (patch: Partial<AnalyticsFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className={cn("space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4", className)}>
      {/* Row 1: Risk tiers + dropdowns */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Risk tier chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500 mr-1">Risk:</span>
          {RISK_TIERS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => update({ riskTier: t.value })}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                filters.riskTier === t.value
                  ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Jurisdiction dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Region:</span>
          <select
            value={filters.jurisdiction}
            onChange={(e) => update({ jurisdiction: e.target.value as JurisdictionFilter })}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label={t("a11y.filterJurisdiction")}
          >
            {JURISDICTIONS.map((j) => (
              <option key={j.value} value={j.value}>
                {j.label}
              </option>
            ))}
          </select>
        </div>

        {/* Category dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Category:</span>
          <select
            value={filters.category}
            onChange={(e) => update({ category: e.target.value as CategoryFilter })}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label={t("a11y.filterCategory")}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Date range picker */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Period:</span>
        <DateRangePicker
          value={filters.dateRange}
          customRange={filters.customDateRange}
          onChange={(preset, range) =>
            update({ dateRange: preset, customDateRange: range })
          }
        />
      </div>

      {/* Active filter summary + clear */}
      {hasActiveFilters(filters) && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-zinc-800/60 px-3 py-1.5">
          <p className="text-xs text-zinc-400">{buildSummary(filters)}</p>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label={t("a11y.clearFilters")}
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
