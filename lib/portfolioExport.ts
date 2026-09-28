/**
 * Portfolio export pipeline — live position filtering + CSV/PDF row mapping.
 *
 * Converts investor positions into export-ready rows that respect the active
 * analytics filters (risk tier, jurisdiction, category, date range).
 */

import type { AnalyticsFilters } from "@/components/analytics/AnalyticsFilterBar";
import type { DateRange, PresetRange } from "@/components/analytics/DateRangePicker";
import type { InvestorPosition, InvoicePosition } from "@/types/invoice";

export const PORTFOLIO_EXPORT_HEADERS = [
  "Invoice ID",
  "Debtor",
  "Face Value",
  "Funded Amount",
  "APR",
  "Maturity Date",
  "Status",
  "Expected Return",
  "Transaction Hash",
] as const;

export type PortfolioExportHeader = (typeof PORTFOLIO_EXPORT_HEADERS)[number];

export type PortfolioExportRow = Record<PortfolioExportHeader, string | number>;

export type ExportablePosition = InvestorPosition | InvoicePosition;

/** Resolve the inclusive [from, to] window for a preset or custom date range. */
export function resolveDateRangeBounds(
  dateRange: PresetRange | "custom",
  customDateRange?: DateRange,
  now: Date = new Date()
): { from: Date | null; to: Date | null } {
  if (dateRange === "all") {
    return { from: null, to: null };
  }

  if (dateRange === "custom") {
    return {
      from: customDateRange?.from ?? null,
      to: customDateRange?.to ?? null,
    };
  }

  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);

  if (dateRange === "ytd") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    return { from, to };
  }

  if (dateRange === "1y") {
    const from = new Date(now);
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    from.setUTCHours(0, 0, 0, 0);
    return { from, to };
  }

  const days: Record<"7d" | "30d" | "90d", number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (days[dateRange] ?? 30));
  from.setUTCHours(0, 0, 0, 0);
  return { from, to };
}

function matchesDateRange(
  investedAt: string,
  dateRange: PresetRange | "custom",
  customDateRange?: DateRange,
  now?: Date
): boolean {
  const { from, to } = resolveDateRangeBounds(dateRange, customDateRange, now);
  if (!from && !to) return true;

  const ts = new Date(investedAt).getTime();
  if (Number.isNaN(ts)) return false;
  if (from && ts < from.getTime()) return false;
  if (to && ts > to.getTime()) return false;
  return true;
}

/**
 * Filter live positions by the active analytics filters.
 * Date filtering uses `investedAt`; metadata filters use nested invoice fields.
 */
export function filterPositionsForExport<T extends ExportablePosition>(
  positions: T[],
  filters: AnalyticsFilters,
  now: Date = new Date()
): T[] {
  return positions.filter((position) => {
    const invoice = position.invoice;

    if (filters.riskTier !== "all" && invoice?.riskTier !== filters.riskTier) {
      return false;
    }

    if (
      filters.jurisdiction !== "all" &&
      invoice?.metadata?.jurisdiction !== filters.jurisdiction
    ) {
      return false;
    }

    if (
      filters.category !== "all" &&
      invoice?.metadata?.category !== filters.category
    ) {
      return false;
    }

    return matchesDateRange(
      position.investedAt,
      filters.dateRange,
      filters.customDateRange,
      now
    );
  });
}

/** Map a live position into a CSV/PDF export row (includes tx hash). */
export function positionToExportRow(position: ExportablePosition): PortfolioExportRow {
  const invoice = position.invoice;
  const invoiceId =
    invoice?.metadata?.invoiceNumber ||
    position.invoiceId ||
    ("id" in position ? position.id : undefined) ||
    "";

  const maturity =
    invoice?.terms?.repaymentDate ||
    invoice?.metadata?.dueDate ||
    "";

  return {
    "Invoice ID": invoiceId,
    Debtor: invoice?.metadata?.debtorName ?? "",
    "Face Value": invoice?.metadata?.amount ?? 0,
    "Funded Amount": position.investedAmount,
    APR: invoice?.terms?.apr ?? 0,
    "Maturity Date": maturity ? new Date(maturity).toISOString() : "",
    Status: position.status,
    "Expected Return": position.expectedReturn,
    "Transaction Hash": invoice?.txHash ?? "",
  };
}

/** Convert filtered positions into export rows ready for `exportCsv`. */
export function positionsToExportRows(
  positions: ExportablePosition[]
): PortfolioExportRow[] {
  return positions.map(positionToExportRow);
}

/** Build a dated portfolio CSV filename: `kora-portfolio-YYYY-MM-DD.csv`. */
export function portfolioExportFilename(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `kora-portfolio-${yyyy}-${mm}-${dd}.csv`;
}

/** Build a dated analytics PDF filename (no extension — `exportPdf` adds it). */
export function portfolioPdfFilename(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `kora-analytics-${yyyy}-${mm}-${dd}`;
}

export const MARKETPLACE_EXPORT_HEADERS = [
  "Invoice ID",
  "Debtor Name",
  "Issuer Name",
  "Amount",
  "Currency",
  "APR (%)",
  "Risk Tier",
  "Category",
  "Jurisdiction",
  "Status",
  "Due Date",
  "Repayment Date",
] as const;

export type MarketplaceExportHeader = (typeof MARKETPLACE_EXPORT_HEADERS)[number];
export type MarketplaceExportRow = Record<MarketplaceExportHeader, string | number>;

/** Convert active marketplace invoices into sanitized export rows. */
export function marketplaceInvoicesToExportRows(
  invoices: Array<{
    id: string;
    riskTier: string;
    status: string;
    metadata: {
      invoiceNumber?: string;
      debtorName?: string;
      issuerName?: string;
      amount: number;
      currency: string;
      category: string;
      jurisdiction: string;
      dueDate?: string;
    };
    terms: {
      apr: number;
      repaymentDate: string;
    };
  }>
): MarketplaceExportRow[] {
  return invoices.map((inv) => ({
    "Invoice ID": inv.metadata.invoiceNumber || inv.id,
    "Debtor Name": inv.metadata.debtorName || "Redacted",
    "Issuer Name": inv.metadata.issuerName || "",
    Amount: inv.metadata.amount,
    Currency: inv.metadata.currency,
    "APR (%)": inv.terms.apr,
    "Risk Tier": inv.riskTier,
    Category: inv.metadata.category,
    Jurisdiction: inv.metadata.jurisdiction,
    Status: inv.status,
    "Due Date": inv.metadata.dueDate ? new Date(inv.metadata.dueDate).toISOString() : "",
    "Repayment Date": inv.terms.repaymentDate
      ? new Date(inv.terms.repaymentDate).toISOString()
      : "",
  }));
}

/** Build a dated marketplace CSV filename: `kora-marketplace-YYYY-MM-DD.csv`. */
export function marketplaceExportFilename(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `kora-marketplace-${yyyy}-${mm}-${dd}.csv`;
}

