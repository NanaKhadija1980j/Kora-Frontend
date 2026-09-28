/**
 * Client-side portfolio PDF digest (issue #602).
 *
 * The building blocks existed — jspdf, html2canvas, CSV row mapping — but
 * there was no one-click branded summary an investor could file or forward.
 *
 * The document is composed as **data** here and rendered by a thin jspdf
 * adapter in `renderDigestPdf`. That split means the content is unit-testable
 * without a canvas, and the "no secrets in the PDF" acceptance criterion is
 * enforceable by inspecting a plain object rather than scraping a binary.
 */

import {
  filterPositionsForExport,
  positionsToExportRows,
  type ExportablePosition,
  type PortfolioExportRow,
} from "@/lib/portfolioExport";
import type { AnalyticsFilters } from "@/components/analytics/AnalyticsFilterBar";

export interface DigestSummary {
  positionCount: number;
  totalInvested: number;
  totalExpectedReturn: number;
  totalYieldEarned: number;
  /** Weighted average APR across positions, weighted by invested amount. */
  weightedApr: number;
}

export interface DigestSection {
  heading: string;
  rows: Array<[label: string, value: string]>;
}

export interface DigestDocument {
  title: string;
  subtitle: string;
  /** ISO timestamp the digest was generated. */
  generatedAt: string;
  /** Human summary of the filters this digest reflects. */
  filterSummary: string;
  summary: DigestSummary;
  sections: DigestSection[];
  tableHeaders: string[];
  tableRows: Array<Array<string | number>>;
  disclaimer: string;
}

export const DIGEST_DISCLAIMER =
  "This digest is generated locally in your browser from your own portfolio data. " +
  "Figures are indicative and not a statement of account.";

/**
 * Fields that must never reach the PDF.
 *
 * A digest is made to be forwarded by email, so anything that identifies a
 * wallet or lets someone look up a transaction is out. `Transaction Hash` is
 * part of the CSV export — where the user is deliberately extracting raw data —
 * but a shareable summary is a different context with a different audience.
 */
export const DIGEST_REDACTED_COLUMNS = [
  "Transaction Hash",
  "Wallet",
  "Wallet Address",
  "Investor Address",
  "Issuer Address",
  "Debtor Address",
] as const;

function isRedacted(header: string): boolean {
  return (DIGEST_REDACTED_COLUMNS as readonly string[]).includes(header);
}

/** Column order for the digest table, minus anything redacted. */
export function digestTableHeaders(rows: PortfolioExportRow[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]).filter((header) => !isRedacted(header));
}

function safe(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Summarise positions.
 *
 * APR is invested-weighted, not a plain mean: a $100k position at 6% and a $1k
 * position at 20% average to 6.1%, not 13%, and the plain mean would badly
 * misrepresent the book.
 */
export function summarisePositions(positions: ExportablePosition[]): DigestSummary {
  let totalInvested = 0;
  let totalExpectedReturn = 0;
  let totalYieldEarned = 0;
  let aprWeighted = 0;

  for (const position of positions) {
    const invested = safe(position.investedAmount);
    totalInvested += invested;
    totalExpectedReturn += safe(position.expectedReturn);
    totalYieldEarned += safe((position as { yieldEarned?: number }).yieldEarned);
    aprWeighted += safe(position.invoice?.terms?.apr) * invested;
  }

  return {
    positionCount: positions.length,
    totalInvested,
    totalExpectedReturn,
    totalYieldEarned,
    weightedApr: totalInvested > 0 ? aprWeighted / totalInvested : 0,
  };
}

/** Describe the active filters in one line, for the PDF header. */
export function describeFilters(filters: AnalyticsFilters): string {
  const parts: string[] = [];
  if (filters.riskTier && filters.riskTier !== "all") {
    parts.push(`Risk tier: ${filters.riskTier}`);
  }
  if (filters.jurisdiction && filters.jurisdiction !== "all") {
    parts.push(`Jurisdiction: ${filters.jurisdiction}`);
  }
  if (filters.category && filters.category !== "all") {
    parts.push(`Category: ${filters.category}`);
  }
  parts.push(`Period: ${filters.dateRange ?? "all"}`);
  return parts.join(" · ");
}

export interface BuildDigestOptions {
  positions: ExportablePosition[];
  filters: AnalyticsFilters;
  /** Formats a number as currency for display. */
  formatCurrency: (value: number) => string;
  /** Formats a ratio as a percentage for display. */
  formatPercent: (value: number) => string;
  now?: Date;
  /** Branding line under the title. */
  subtitle?: string;
}

/**
 * Compose the digest document from live positions and the active filters.
 *
 * Filtering runs here rather than at the call site so the digest provably
 * reflects the same rows the analytics view is showing.
 */
export function buildDigestDocument({
  positions,
  filters,
  formatCurrency,
  formatPercent,
  now = new Date(),
  subtitle = "Portfolio digest",
}: BuildDigestOptions): DigestDocument {
  const filtered = filterPositionsForExport(positions, filters, now);
  const summary = summarisePositions(filtered);
  const rows = positionsToExportRows(filtered);
  const headers = digestTableHeaders(rows);

  const tableRows = rows.map((row) =>
    headers.map((header) => (row as Record<string, string | number>)[header] ?? "")
  );

  const netYield = summary.totalExpectedReturn - summary.totalInvested;

  return {
    title: "Kora",
    subtitle,
    generatedAt: now.toISOString(),
    filterSummary: describeFilters(filters),
    summary,
    sections: [
      {
        heading: "Summary",
        rows: [
          ["Positions", String(summary.positionCount)],
          ["Total invested", formatCurrency(summary.totalInvested)],
          ["Expected return", formatCurrency(summary.totalExpectedReturn)],
          ["Expected net yield", formatCurrency(netYield)],
          ["Yield earned to date", formatCurrency(summary.totalYieldEarned)],
          ["Weighted average APR", formatPercent(summary.weightedApr)],
        ],
      },
    ],
    tableHeaders: headers,
    tableRows,
    disclaimer: DIGEST_DISCLAIMER,
  };
}

/** Dated digest filename (no extension — the renderer appends `.pdf`). */
export function digestFilename(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `kora-portfolio-digest-${yyyy}-${mm}-${dd}`;
}

/**
 * Build a `mailto:` URL for sharing the digest.
 *
 * The share hook is a stub by design (see the issue): the PDF stays on the
 * user's device and only a short human summary goes into the mail body. It
 * deliberately carries no table rows — a mailto body is plain text that lands
 * in an outbox, a sent-items folder, and any corporate mail archive along the
 * way, which is the wrong place for a position-level breakdown.
 */
export function buildDigestMailto(
  doc: DigestDocument,
  formatCurrency: (value: number) => string,
  to = ""
): string {
  const subject = `Kora portfolio digest — ${doc.generatedAt.slice(0, 10)}`;
  const body = [
    `Portfolio digest generated ${doc.generatedAt.slice(0, 10)}.`,
    "",
    `Positions: ${doc.summary.positionCount}`,
    `Total invested: ${formatCurrency(doc.summary.totalInvested)}`,
    `Expected return: ${formatCurrency(doc.summary.totalExpectedReturn)}`,
    "",
    `Filters — ${doc.filterSummary}`,
    "",
    "The full PDF is attached separately.",
  ].join("\n");

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
