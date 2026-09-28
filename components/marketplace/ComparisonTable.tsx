"use client";

/**
 * ComparisonTable — side-by-side invoice comparison modal.
 *
 * Displays up to 4 invoices in columns with rows for each key metric.
 * The best value in each row is highlighted in green.
 * Each column has an X button to remove that invoice from the comparison.
 * Mobile: collapses to scrollable horizontal table with sticky first column.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { X, TrendingUp, Calendar, Shield, MapPin, Users, DollarSign, Clock, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/ui/badge";
import { InvoiceFundingProgress } from "@/components/ui/progress";
import { InvoiceStatusBadge } from "@/components/invoice/InvoiceStatusBadge";
import { useInvoiceStore } from "@/store/invoiceStore";
import {
  cn,
} from "@/lib/utils";
import { useFormatters } from "@/hooks/useFormatters";
import { useRovingTabIndex } from "@/hooks/useRovingTabIndex";
import type { Invoice } from "@/types";
import { isEnabled } from "@/lib/featureFlags";
import { getMaskedDebtorName } from "@/lib/debtorPrivacy";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComparisonTableProps {
  invoices: Invoice[];
  onClose: () => void;
}

// ─── Row definitions ──────────────────────────────────────────────────────────

type BestValueDirection = "higher" | "lower" | "none";

interface MetricRow {
  label: string;
  icon: React.ElementType;
  getValue: (inv: Invoice) => number | string;
  /** Numeric value used for best-value comparison */
  getNumericValue?: (inv: Invoice) => number;
  /** Whether higher or lower is better */
  bestDirection: BestValueDirection;
  format: (val: number | string, inv: Invoice) => React.ReactNode;
}

function buildMetricRows(
  formatters: ReturnType<typeof useFormatters>,
  tInvoiceCard: (key: string) => string,
  tMarketplace: (key: string) => string
): MetricRow[] {
  const { formatCurrency, formatApr, formatDate } = formatters;
  return [
  {
    label: "Invoice Amount",
    icon: DollarSign,
    getValue: (inv) => inv.metadata.amount,
    getNumericValue: (inv) => inv.metadata.amount,
    bestDirection: "higher",
    format: (val, inv) => formatCurrency(val as number, inv.metadata.currency, true),
  },
  {
    label: tInvoiceCard("aprLabel"),
    icon: TrendingUp,
    getValue: (inv) => inv.terms.apr,
    getNumericValue: (inv) => inv.terms.apr,
    bestDirection: "higher",
    format: (val) => (
      <span className="font-bold text-primary">{formatApr(val as number)}</span>
    ),
  },
  {
    label: tMarketplace("riskTier"),
    icon: Shield,
    getValue: (inv) => inv.riskTier,
    getNumericValue: (inv) => {
      // Lower tier index = lower risk = better
      const order = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"];
      return order.indexOf(inv.riskTier);
    },
    bestDirection: "lower",
    format: (val, inv) => <RiskBadge tier={inv.riskTier} tooltip={false} />,
  },
  {
    label: "Jurisdiction",
    icon: MapPin,
    getValue: (inv) => inv.metadata.jurisdiction,
    bestDirection: "none",
    format: (val) => String(val),
  },
  {
    label: "Due Date",
    icon: Calendar,
    getValue: (inv) => inv.terms.repaymentDate,
    getNumericValue: (inv) => new Date(inv.terms.repaymentDate).getTime(),
    bestDirection: "higher", // further out = more time = better for investor
    format: (val) => formatDate(val as string),
  },
  {
    label: "Tenor",
    icon: Clock,
    getValue: (inv) => inv.terms.tenor,
    getNumericValue: (inv) => inv.terms.tenor,
    bestDirection: "none",
    format: (val) => `${val} days`,
  },
  {
    label: "Funding Progress",
    icon: Activity,
    getValue: (inv) => inv.funding.fundingProgress,
    getNumericValue: (inv) => inv.funding.fundingProgress,
    bestDirection: "none",
    format: (val, inv) => (
      <InvoiceFundingProgress
        funded={inv.funding.totalRaised}
        target={inv.funding.targetAmount}
        currency={inv.metadata.currency}
        className="w-full"
      />
    ),
  },
  {
    label: tInvoiceCard("investorsLabel"),
    icon: Users,
    getValue: (inv) => inv.funding.investorCount,
    getNumericValue: (inv) => inv.funding.investorCount,
    bestDirection: "higher",
    format: (val) => String(val),
  },
  {
    label: "Min Investment",
    icon: DollarSign,
    getValue: (inv) => inv.terms.minInvestment,
    getNumericValue: (inv) => inv.terms.minInvestment,
    bestDirection: "lower",
    format: (val, inv) => formatCurrency(val as number, inv.metadata.currency, true),
  },
  {
    label: "Status",
    icon: Activity,
    getValue: (inv) => inv.status,
    bestDirection: "none",
    format: (val, inv) => <InvoiceStatusBadge status={inv.status} />,
  },
];
}

// ─── Best-value detection ─────────────────────────────────────────────────────

function getBestIndex(
  invoices: Invoice[],
  row: MetricRow
): number | null {
  if (row.bestDirection === "none" || !row.getNumericValue) return null;
  if (invoices.length < 2) return null;

  const values = invoices.map(row.getNumericValue);
  const best =
    row.bestDirection === "higher"
      ? Math.max(...values)
      : Math.min(...values);

  // Only highlight if there's a clear winner (not all equal)
  const allEqual = values.every((v) => v === values[0]);
  if (allEqual) return null;

  return values.indexOf(best);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ComparisonTable({ invoices, onClose }: ComparisonTableProps) {
  const tInvoiceCard = useTranslations("invoiceCard");
  const tMarketplace = useTranslations("marketplace");
  const tCommon = useTranslations("common");
  const { removeFromComparison } = useInvoiceStore();
  const formatters = useFormatters();
  const METRIC_ROWS = buildMetricRows(formatters, tInvoiceCard, tMarketplace);
  const [rowAnnouncement, setRowAnnouncement] = useState("");
  const { registerRef, handleKeyDown, getTabIndex, setActiveIndex } =
    useRovingTabIndex(METRIC_ROWS.length);

  // ─── Feature flag ────────────────────────────────────────────────────────
  if (!isEnabled("comparison")) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Invoice comparison table"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel - mobile: full screen, desktop: max-w-6xl */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <h2 className="text-sm font-bold sm:text-base text-foreground">
              Invoice Comparison
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-primary">
              {invoices.length} selected
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close comparison table"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Live region announcing roving-tabindex row selection for screen readers */}
        <span className="sr-only" role="status" aria-live="polite">
          {rowAnnouncement}
        </span>

        {/* Scrollable table - mobile: horizontal scroll with sticky first column */}
        <div className="overflow-auto flex-1">
          <div className="min-w-[640px] sm:min-w-0">
            <table className="w-full border-collapse text-xs sm:text-sm">
              {/* Column headers — one per invoice */}
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
                <tr>
                  {/* Row label column - sticky on mobile */}
                  <th className="sticky left-0 z-20 w-28 sm:w-36 border-b border-border bg-card px-2 py-2 sm:px-4 sm:py-3 text-left text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Metric
                  </th>
                  {invoices.map((invoice) => (
                    <th
                      key={invoice.id}
                      className="border-b border-border px-2 py-2 sm:px-4 sm:py-3 text-left min-w-[140px] sm:min-w-[200px]"
                    >
                      <div className="flex items-start justify-between gap-1 sm:gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs sm:text-sm font-semibold text-foreground">
                            {getMaskedDebtorName(invoice)}
                          </p>
                          <p className="mt-0.5 truncate text-[8px] sm:text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {invoice.metadata.invoiceNumber}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromComparison(invoice.id)}
                          className="shrink-0 rounded-full p-0.5 sm:p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          aria-label={tInvoiceCard("removeFromCompare", { debtor: getMaskedDebtorName(invoice) })}
                        >
                          <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {METRIC_ROWS.map((row, rowIdx) => {
                  const bestIndex = getBestIndex(invoices, row);
                  const Icon = row.icon;

                  return (
                    <tr
                      key={row.label}
                      ref={registerRef(rowIdx)}
                      tabIndex={getTabIndex(rowIdx)}
                      role="row"
                      aria-label={row.label}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx)}
                      onFocus={() => {
                        setActiveIndex(rowIdx);
                        setRowAnnouncement(`${row.label} row selected`);
                      }}
                      className={cn(
                        "border-b border-border/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                        rowIdx % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                      )}
                    >
                      {/* Row label - sticky on mobile */}
                      <td className="sticky left-0 z-10 bg-card px-2 py-2 sm:px-4 sm:py-3 align-middle">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                          <span className="hidden sm:inline">{row.label}</span>
                          <span className="sm:hidden">{row.label.slice(0, 4)}</span>
                        </div>
                      </td>

                      {/* Invoice values */}
                      {invoices.map((invoice, colIdx) => {
                        const isBest = bestIndex === colIdx;
                        const rawValue = row.getValue(invoice);

                        return (
                          <td
                            key={invoice.id}
                            className={cn(
                              "px-2 py-2 sm:px-4 sm:py-3 align-middle",
                              isBest &&
                                "bg-emerald-500/5 border-l-2 border-l-emerald-500/40"
                            )}
                          >
                            <div className="flex items-center gap-1 sm:gap-1.5">
                              <span
                                className={cn(
                                  "text-xs sm:text-sm",
                                  isBest
                                    ? "font-semibold text-emerald-400"
                                    : "text-foreground"
                                )}
                              >
                                {row.format(rawValue, invoice)}
                              </span>
                              {isBest && (
                                <span
                                  className="rounded-full bg-emerald-500/10 px-1 py-0.5 text-[7px] sm:text-[9px] font-bold uppercase tracking-wider text-emerald-400"
                                  aria-label="Best value"
                                >
                                  Best
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer — CTA links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border px-3 py-3 shrink-0 sm:px-6 sm:py-4">
          <div className="flex w-full sm:w-auto gap-2">
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/marketplace/${invoice.id}`}
                onClick={onClose}
                className="flex-1 sm:flex-none"
              >
                <Button size="sm" className="w-full sm:w-auto gap-1 text-xs sm:text-sm">
                  Fund {invoice.metadata.invoiceNumber}
                </Button>
              </Link>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
            {tCommon("close")}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}