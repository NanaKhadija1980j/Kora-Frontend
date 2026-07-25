"use client";

import { motion } from "framer-motion";
import { useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const AnalyticsCharts = dynamic(() => import("@/components/analytics/AnalyticsCharts"), {
  ssr: false,
  loading: () => <AnalyticsSkeleton />,
});
import { TrendingUp, DollarSign, BarChart3, Shield } from "lucide-react";
import { AnalyticsSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { useWallet } from "@/hooks/useWallet";
import { usePositions } from "@/hooks/usePositions";
import { useUIStore, useInvoiceStore, DEFAULT_FILTERS as MARKETPLACE_DEFAULT_FILTERS } from "@/store";
import { Button } from "@/components/ui/button";
import { PrintButton, PrintLayout } from "@/components/ui/print-layout";
import { formatCurrency } from "@/lib/utils";
import { exportCsv, exportPdf } from "@/lib/export";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  AnalyticsFilterBar,
  DEFAULT_FILTERS,
  type AnalyticsFilters,
  type RiskTierFilter,
  type JurisdictionFilter,
  type CategoryFilter,
} from "@/components/analytics/AnalyticsFilterBar";
import type { PresetRange } from "@/components/analytics/DateRangePicker";
import {
  aggregatePositions,
  marketplacePathForAllocation,
  allocationToMarketplaceFilters,
} from "@/lib/portfolioAllocation";

// ── Mock analytics data (time-series history; risk uses live positions) ───────

const PORTFOLIO_HISTORY = [
  { month: "Jun", value: 0 },
  { month: "Jul", value: 25000 },
  { month: "Aug", value: 48000 },
  { month: "Sep", value: 72000 },
  { month: "Oct", value: 115000 },
  { month: "Nov", value: 170000 },
];

const YIELD_HISTORY = [
  { month: "Jun", yield: 0 },
  { month: "Jul", yield: 420 },
  { month: "Aug", yield: 890 },
  { month: "Sep", yield: 1540 },
  { month: "Oct", yield: 2800 },
  { month: "Nov", yield: 4200 },
];

const MONTHLY_RETURNS = [
  { month: "Jun", return: 0 },
  { month: "Jul", return: 1.68 },
  { month: "Aug", return: 1.85 },
  { month: "Sep", return: 2.14 },
  { month: "Oct", return: 2.43 },
  { month: "Nov", return: 2.47 },
];

const toCsvRows = <T extends object>(rows: T[]): Record<string, unknown>[] =>
  rows.map((row) => Object.fromEntries(Object.entries(row)));

// ── URL ↔ filter helpers ───────────────────────────────────────────────────────

function filtersFromParams(params: URLSearchParams): AnalyticsFilters {
  return {
    riskTier: (params.get("risk") as RiskTierFilter) ?? DEFAULT_FILTERS.riskTier,
    jurisdiction: (params.get("jurisdiction") as JurisdictionFilter) ?? DEFAULT_FILTERS.jurisdiction,
    category: (params.get("category") as CategoryFilter) ?? DEFAULT_FILTERS.category,
    dateRange: (params.get("range") as PresetRange | "custom") ?? DEFAULT_FILTERS.dateRange,
  };
}

function filtersToParams(filters: AnalyticsFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.riskTier !== "all") p.set("risk", filters.riskTier);
  if (filters.jurisdiction !== "all") p.set("jurisdiction", filters.jurisdiction);
  if (filters.category !== "all") p.set("category", filters.category);
  if (filters.dateRange !== "30d") p.set("range", filters.dateRange);
  return p;
}

// ── Slice helpers (mock — in real app filter by actual data timestamps/fields) ─

function sliceByRange<T>(data: T[], range: PresetRange | "custom"): T[] {
  const counts: Record<string, number> = { "7d": 1, "30d": 2, "90d": 4, ytd: 5, all: 6, custom: 6 };
  return data.slice(-(counts[range] ?? 6));
}

// ── Page ──────────────────────────────────────────────────────────────────────

function PortfolioAnalyticsInner() {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const { setFilters, resetFilters } = useInvoiceStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const positionsQuery = usePositions(address ?? undefined, { refetchInterval: 30_000 });
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  const handleFiltersChange = useCallback(
    (next: AnalyticsFilters) => {
      const params = filtersToParams(next);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router]
  );

  const handleRiskSegmentClick = useCallback(
    (riskTier: string) => {
      const allocationFilter = {
        dimension: "riskTier" as const,
        value: riskTier,
      };
      resetFilters();
      setFilters({
        ...MARKETPLACE_DEFAULT_FILTERS,
        ...allocationToMarketplaceFilters(allocationFilter),
      });
      router.push(marketplacePathForAllocation(allocationFilter));
    },
    [resetFilters, setFilters, router]
  );

  // Slice data based on active filters
  const portfolio = useMemo(() => sliceByRange(PORTFOLIO_HISTORY, filters.dateRange), [filters.dateRange]);
  const yieldData = useMemo(() => sliceByRange(YIELD_HISTORY, filters.dateRange), [filters.dateRange]);
  const risk = useMemo(() => {
    const slices = aggregatePositions(positionsQuery.data ?? [], "riskTier").map(
      (s) => ({
        name: s.name,
        value: Math.round(s.percent * 10) / 10,
        color: s.color,
      })
    );
    if (filters.riskTier === "all") return slices;
    return slices.filter((d) => d.name === filters.riskTier);
  }, [positionsQuery.data, filters.riskTier]);
  const monthly = useMemo(() => sliceByRange(MONTHLY_RETURNS, filters.dateRange), [filters.dateRange]);

  const positionsData = positionsQuery.data ?? [];
  const totalInvested = positionsData.reduce((sum, position) => sum + position.investedAmount, 0);
  const totalExpected = positionsData.reduce((sum, position) => sum + position.expectedReturn, 0);
  const totalYield = totalExpected - totalInvested;
  const averageApr = positionsData.length
    ? positionsData.reduce((sum, position) => sum + (position.invoice?.terms.apr ?? 0), 0) / positionsData.length
    : 0;

  const stats = [
    {
      label: "Portfolio Value",
      value: formatCurrency(totalInvested, "USDC", true),
      change: `${positionsData.length} ${positionsData.length === 1 ? "position" : "positions"}`,
      changePositive: true,
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      label: "Expected Yield",
      value: formatCurrency(totalYield, "USDC", true),
      change: totalInvested > 0 ? `${((totalYield / totalInvested) * 100).toFixed(1)}% return` : "0.0% return",
      changePositive: true,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      label: "Active Positions",
      value: positionsData.length.toString(),
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      label: "Avg. APR",
      value: `${averageApr.toFixed(1)}%`,
      change: "Across all positions",
      changePositive: true,
      icon: <Shield className="h-4 w-4" />,
    },
  ];

  const handleExport = useCallback((type: "portfolio" | "yield" | "risk" | "monthly") => {
    let data, filename;
    switch (type) {
      case "portfolio":
        data = portfolio;
        filename = `kora-portfolio-${range}-${Date.now()}.csv`;
        break;
      case "yield":
        data = yieldData;
        filename = `kora-yield-${range}-${Date.now()}.csv`;
        break;
      case "risk":
        data = risk;
        filename = `kora-risk-${range}-${Date.now()}.csv`;
        break;
      case "monthly":
        data = monthly;
        filename = `kora-returns-${range}-${Date.now()}.csv`;
        break;
    }

    // Convert to CSV
    const headers = Object.keys(data[0] || {});
    const csv = [
      headers.join(","),
      ...data.map((row: any) => headers.map((h) => row[h]).join(",")),
    ].join("\n");

    // Download
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [portfolio, yieldData, risk, monthly, range]);

  const handleReset = useCallback(() => {
    setRange("30d");
  }, []);

  if (!isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Connect your wallet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          View your portfolio analytics, performance metrics, and investment data
        </p>
        <Button onClick={() => setWalletModalOpen(true)} className="mt-4">
          <span>Connect Wallet</span>
        </Button>
      </motion.div>
    );
  }

  return (
    <ErrorBoundary>
      <PrintLayout title="Kora Portfolio Analytics" subtitle="Invoice financing portfolio performance">
        <div id="analytics-report" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Portfolio Analytics</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Performance overview of your invoice financing portfolio
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                onClick={() => exportCsv(portfolio as any, "kora-portfolio.csv")}
              >
                Export CSV
              </button>
              <button
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                onClick={() => exportPdf("analytics-report", `kora-analytics-${new Date().toISOString().split("T")[0]}`)}
              >
                Export PDF
              </button>
              <PrintButton />
            </div>
          </div>

          {/* Filter bar */}
          <div className="mb-6 print:hidden">
            <AnalyticsFilterBar filters={filters} onChange={handleFiltersChange} />
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <StatCard {...stat} />
              </motion.div>
            ))}
          </div>

          {/* Charts */}
          <AnalyticsCharts
            portfolio={portfolio}
            yieldData={yieldData}
            monthly={monthly}
            risk={risk}
            isLoading={positionsQuery.isLoading}
            onRiskSegmentClick={handleRiskSegmentClick}
          />
        </div>
      </PrintLayout>

    </ErrorBoundary>
  );
}

import { Suspense } from "react";

export default function PortfolioAnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <PortfolioAnalyticsInner />
    </Suspense>
  );
}
