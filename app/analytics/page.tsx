"use client";

import { motion } from "framer-motion";
import { useMemo, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
const YieldVarianceChart = dynamic(() => import("@/components/analytics/YieldVarianceChart"), {
  ssr: false,
});

const AnalyticsCharts = dynamic(() => import("@/components/analytics/AnalyticsCharts"), {
  ssr: false,
  loading: () => <AnalyticsSkeleton />,
});

const YieldProjectionCalculator = dynamic(
  () =>
    import("@/components/dashboard/YieldProjectionCalculator").then(
      (mod) => mod.YieldProjectionCalculator
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] w-full animate-pulse rounded-xl border border-zinc-800 bg-zinc-950/50" />
    ),
  }
);
import { BarChart3, DollarSign, TrendingUp, Shield } from "lucide-react";
import { AnalyticsSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { useWallet } from "@/hooks/useWallet";
import { useFormatters } from "@/hooks/useFormatters";
import { usePositions } from "@/hooks/usePositions";
import { buildDigestDocument, buildDigestMailto, digestFilename } from "@/lib/portfolioDigest";
import { renderDigestPdf } from "@/lib/portfolioDigestPdf";
import {
  useUIStore,
  useInvoiceStore,
  DEFAULT_FILTERS as MARKETPLACE_DEFAULT_FILTERS,
} from "@/store";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { PrintButton, PrintLayout } from "@/components/ui/print-layout";
import { exportCsv, exportPdf } from "@/lib/export";
import { VintageCohortTable } from "@/components/analytics/VintageCohortTable";
import {
  PORTFOLIO_EXPORT_HEADERS,
  filterPositionsForExport,
  positionsToExportRows,
  portfolioExportFilename,
  portfolioPdfFilename,
  resolveDateRangeBounds,
} from "@/lib/portfolioExport";
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
  buildPortfolioTimeSeries,
  marketplacePathForAllocation,
  allocationToMarketplaceFilters,
} from "@/lib/portfolioAllocation";

// ── URL ↔ filter helpers ───────────────────────────────────────────────────────

function filtersFromParams(params: URLSearchParams): AnalyticsFilters {
  const dateRange = (params.get("range") as PresetRange | "custom") ?? DEFAULT_FILTERS.dateRange;
  const fromStr = params.get("from");
  const toStr = params.get("to");

  const result: AnalyticsFilters = {
    riskTier: (params.get("risk") as RiskTierFilter) ?? DEFAULT_FILTERS.riskTier,
    jurisdiction:
      (params.get("jurisdiction") as JurisdictionFilter) ?? DEFAULT_FILTERS.jurisdiction,
    category: (params.get("category") as CategoryFilter) ?? DEFAULT_FILTERS.category,
    dateRange,
  };

  if (dateRange === "custom" && fromStr && toStr) {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) {
      result.customDateRange = { from, to };
    } else {
      // Invalid custom range — fall back to default
      result.dateRange = DEFAULT_FILTERS.dateRange;
    }
  }

  return result;
}

function filtersToParams(filters: AnalyticsFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.riskTier !== "all") p.set("risk", filters.riskTier);
  if (filters.jurisdiction !== "all") p.set("jurisdiction", filters.jurisdiction);
  if (filters.category !== "all") p.set("category", filters.category);
  if (filters.dateRange !== DEFAULT_FILTERS.dateRange) p.set("range", filters.dateRange);
  if (
    filters.dateRange === "custom" &&
    filters.customDateRange?.from &&
    filters.customDateRange?.to
  ) {
    const from = filters.customDateRange.from;
    const to = filters.customDateRange.to;
    if (from > to) {
      // Invalid range — don't persist
      return p;
    }
    p.set("from", from.toISOString().split("T")[0]);
    p.set("to", to.toISOString().split("T")[0]);
  }
  return p;
}

// ── Page ──────────────────────────────────────────────────────────────────────

function PortfolioAnalyticsInner() {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const { setFilters, resetFilters } = useInvoiceStore();
  const t = useTranslations("analytics");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Single positionsQuery — refetch every 30 s while tab is visible
  const positionsQuery = usePositions(address ?? undefined, { refetchInterval: 30_000 });

  const { formatCurrency, formatPercentage } = useFormatters();
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
      const allocationFilter = { dimension: "riskTier" as const, value: riskTier };
      resetFilters();
      setFilters({
        ...MARKETPLACE_DEFAULT_FILTERS,
        ...allocationToMarketplaceFilters(allocationFilter),
      });
      router.push(marketplacePathForAllocation(allocationFilter));
    },
    [resetFilters, setFilters, router]
  );

  const positionsData = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);
  const filteredPositions = useMemo(
    () => filterPositionsForExport(positionsData, filters),
    [positionsData, filters]
  );
  const exportRows = useMemo(() => positionsToExportRows(filteredPositions), [filteredPositions]);
  const hasExportData = exportRows.length > 0;

  // ── PDF digest (#602) ─────────────────────────────────────────────────────
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);

  // Composed from the *unfiltered* list plus the active filters:
  // `buildDigestDocument` re-applies them, so the digest provably reflects
  // the same rows the page is showing. Shared by the PDF and mailto actions
  // so both read from one source of truth.
  const buildDigest = useCallback(
    () =>
      buildDigestDocument({
        positions: positionsData,
        filters,
        formatCurrency: (value) => formatCurrency(value, "USDC"),
        formatPercent: (value) => formatPercentage(value, 2),
      }),
    [positionsData, filters, formatCurrency, formatPercentage]
  );

  const handleDownloadDigest = useCallback(async () => {
    setIsGeneratingDigest(true);
    try {
      await renderDigestPdf(buildDigest(), { filename: digestFilename() });
    } catch (error) {
      console.error("[analytics] digest generation failed", error);
    } finally {
      setIsGeneratingDigest(false);
    }
  }, [buildDigest]);

  // Issue #710: mailto share for advisors/forwarding — summary stats only,
  // no position-level rows (see buildDigestMailto's doc comment for why).
  const handleShareDigest = useCallback(() => {
    window.location.href = buildDigestMailto(buildDigest(), (value) =>
      formatCurrency(value, "USDC")
    );
  }, [buildDigest, formatCurrency]);

  // The same filtered live positions drive the charts, table, and exports.
  // Explicit mock mode is handled by usePositions; an empty live portfolio
  // produces a zero baseline instead of fabricated growth.
  const { portfolio, yieldData, monthly } = useMemo(() => {
    const { from, to } = resolveDateRangeBounds(
      filters.dateRange,
      filters.customDateRange
    );
    return buildPortfolioTimeSeries(filteredPositions, to ?? from ?? new Date());
  }, [filteredPositions, filters.dateRange, filters.customDateRange]);
  const risk = useMemo(() => {
    const slices = aggregatePositions(filteredPositions, "riskTier").map((s) => ({
      name: s.name,
      value: Math.round(s.percent * 10) / 10,
      color: s.color,
    }));
    if (filters.riskTier === "all") return slices;
    return slices.filter((d) => d.name === filters.riskTier);
  }, [filteredPositions, filters.riskTier]);
  const totalInvested = filteredPositions.reduce(
    (sum, position) => sum + position.investedAmount,
    0
  );
  const totalExpected = filteredPositions.reduce(
    (sum, position) => sum + position.expectedReturn,
    0
  );
  const totalYield = totalExpected - totalInvested;
  const averageApr = filteredPositions.length
    ? filteredPositions.reduce((sum, position) => sum + (position.invoice?.terms.apr ?? 0), 0) /
      filteredPositions.length
    : 0;

  const defaultTier = useMemo(() => {
    const RISK_TIERS_LIST = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"];
    const validPositions = filteredPositions.filter(
      (p) => p.invoice?.riskTier && RISK_TIERS_LIST.includes(p.invoice.riskTier)
    );
    if (validPositions.length === 0) {
      return "A";
    }
    let totalWeight = 0;
    let weightedSum = 0;
    for (const pos of validPositions) {
      const tier = pos.invoice!.riskTier!;
      const weight = pos.investedAmount;
      const index = RISK_TIERS_LIST.indexOf(tier);
      weightedSum += index * weight;
      totalWeight += weight;
    }
    if (totalWeight === 0) return "A";
    const avgIndex = Math.round(weightedSum / totalWeight);
    return RISK_TIERS_LIST[avgIndex] || "A";
  }, [filteredPositions]);

  const stats = [
    {
      label: "Portfolio Value",
      value: formatCurrency(totalInvested, "USDC", true),
      change: `${filteredPositions.length} ${filteredPositions.length === 1 ? "position" : "positions"}`,
      changePositive: true,
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      label: "Expected Yield",
      value: formatCurrency(totalYield, "USDC", true),
      change:
        totalInvested > 0
          ? `${formatPercentage((totalYield / totalInvested) * 100, 1)} return`
          : "0.0% return",
      changePositive: true,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      label: "Active Positions",
      value: filteredPositions.length.toString(),
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      label: "Avg. APR",
      value: `${averageApr.toFixed(1)}%`,
      change: "Across filtered positions",
      changePositive: true,
      icon: <Shield className="h-4 w-4" />,
    },
  ];

  const handleExportCsv = useCallback(() => {
    if (!hasExportData) return;
    exportCsv(exportRows as Record<string, unknown>[], portfolioExportFilename(), [
      ...PORTFOLIO_EXPORT_HEADERS,
    ]);
  }, [exportRows, hasExportData]);

  /**
   * Issue #605: cohorts export on their own axis. They are one row per month,
   * not per position, so they cannot share the position CSV's headers.
   */
  const handleExportCohorts = useCallback(
    (rows: Array<Record<string, string | number>>) => {
      if (rows.length === 0) return;
      exportCsv(
        rows as Record<string, unknown>[],
        portfolioExportFilename().replace(/\.csv$/, "-vintage-cohorts.csv"),
        Object.keys(rows[0])
      );
    },
    []
  );

  const handleExportPdf = useCallback(() => {
    if (!hasExportData) return;
    void exportPdf("analytics-report", portfolioPdfFilename());
  }, [hasExportData]);

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
        <h2 className="text-2xl font-semibold text-foreground">{t("connectTitle")}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{t("connectDesc")}</p>
        <Button onClick={() => setWalletModalOpen(true)} className="mt-4">
          <span>{tCommon("connectWallet")}</span>
        </Button>
      </motion.div>
    );
  }

  return (
    <ErrorBoundary>
      <PrintLayout
        title="Kora Portfolio Analytics"
        subtitle="Invoice financing portfolio performance"
      >
        <div id="analytics-report" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div data-tour="analytics-header">
              <h1 className="text-2xl font-bold text-zinc-100">{t("title")}</h1>
              <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                disabled={!hasExportData}
                aria-disabled={!hasExportData}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-800"
                onClick={handleExportCsv}
              >
                Export CSV
              </button>
              <button
                type="button"
                disabled={!hasExportData}
                aria-disabled={!hasExportData}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-800"
                onClick={handleExportPdf}
              >
                Export PDF
              </button>
              {/*
                PDF digest (#602) — distinct from "Export PDF", which
                screenshots this page. The digest is a branded, text-based
                summary of the filtered portfolio with sensitive columns
                redacted, meant to be filed or forwarded.
              */}
              <button
                type="button"
                disabled={!hasExportData || isGeneratingDigest}
                aria-disabled={!hasExportData || isGeneratingDigest}
                aria-label="Download portfolio PDF digest"
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-800"
                onClick={handleDownloadDigest}
              >
                {isGeneratingDigest ? "Generating…" : "PDF Digest"}
              </button>
              {/*
                Issue #710: one-click mailto for forwarding the digest summary
                to an advisor — the PDF itself stays on-device, this only
                opens the user's mail client with the summary pre-filled.
              */}
              <button
                type="button"
                disabled={!hasExportData}
                aria-disabled={!hasExportData}
                aria-label="Share portfolio digest via email"
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-800"
                onClick={handleShareDigest}
              >
                Share via Email
              </button>
              <PrintButton />
            </div>
          </div>

          {/* Filter bar — changes push new URL params, charts re-slice instantly */}
          <div className="mb-6 print:hidden">
            <AnalyticsFilterBar filters={filters} onChange={handleFiltersChange} />
          </div>

          {/* Stat cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

          {/* Yield Projection Calculator */}
          <div className="mb-6 print-hidden">
            <YieldProjectionCalculator defaultTier={defaultTier} />
          </div>

          {/* Charts */}
          <AnalyticsCharts
            portfolio={portfolio}
            yieldData={yieldData}
            monthly={monthly}
            risk={risk}
            isLoading={positionsQuery.isLoading}
            onRiskSegmentClick={handleRiskSegmentClick}
            positions={filteredPositions}
          />

          {/* Issue #605: cohorts are built from the *filtered* positions, so the
              vintage view respects the same date-range and risk filters as every
              other panel on this page. */}
          <VintageCohortTable
            className="mt-10 rounded-xl border border-zinc-800 p-4"
            positions={filteredPositions}
            onExport={handleExportCohorts}
          />

          {/* Filtered positions — included in PDF/print layout */}
          <section
            id="portfolio-export-table"
            className="mt-10 overflow-hidden rounded-xl border border-zinc-800"
            aria-label="Filtered portfolio positions"
          >
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">
                Positions ({filteredPositions.length})
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Live positions matching the active filters
              </p>
            </div>
            {hasExportData ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-zinc-900/80 text-zinc-400">
                    <tr>
                      {PORTFOLIO_EXPORT_HEADERS.map((header) => (
                        <th key={header} className="px-3 py-2 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exportRows.map((row) => (
                      <tr
                        key={`${row["Invoice ID"]}-${row["Transaction Hash"]}`}
                        className="border-t border-zinc-800/80 text-zinc-200"
                      >
                        {PORTFOLIO_EXPORT_HEADERS.map((header) => (
                          <td key={header} className="px-3 py-2 font-mono tabular-nums">
                            {row[header] === "" ? "—" : String(row[header])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">
                No positions match the current filters.
              </p>
            )}
          </section>
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
