/**
 * Portfolio PDF digest tests (issue #602).
 *
 * The digest is composed as data so its content — especially the redaction
 * rules — is assertable without rendering a PDF.
 */

import { describe, it, expect } from "vitest";
import {
  DIGEST_DISCLAIMER,
  DIGEST_REDACTED_COLUMNS,
  buildDigestDocument,
  buildDigestMailto,
  describeFilters,
  digestFilename,
  digestTableHeaders,
  summarisePositions,
} from "@/lib/portfolioDigest";
import { positionsToExportRows } from "@/lib/portfolioExport";
import type { AnalyticsFilters } from "@/components/analytics/AnalyticsFilterBar";
import type { InvestorPosition } from "@/types/invoice";

const ALL_FILTERS: AnalyticsFilters = {
  riskTier: "all",
  jurisdiction: "all",
  category: "all",
  dateRange: "all",
};

function position(overrides: Record<string, unknown> = {}): InvestorPosition {
  return {
    id: "pos-1",
    invoiceId: "inv-1",
    investedAmount: 1000,
    expectedReturn: 1100,
    yieldEarned: 40,
    investedAt: "2026-01-15T00:00:00.000Z",
    status: "active",
    invoice: {
      riskTier: "AAA",
      txHash: "abc123secrethash",
      terms: { apr: 10, repaymentDate: "2026-06-01T00:00:00.000Z" },
      metadata: {
        invoiceNumber: "INV-1",
        debtorName: "Acme",
        amount: 5000,
        jurisdiction: "US",
        category: "logistics",
        dueDate: "2026-06-01T00:00:00.000Z",
      },
    },
    ...overrides,
  } as unknown as InvestorPosition;
}

const money = (v: number) => `$${v.toFixed(2)}`;
const percent = (v: number) => `${v.toFixed(2)}%`;

describe("summarisePositions", () => {
  it("totals invested, expected return and yield", () => {
    const summary = summarisePositions([
      position(),
      position({ id: "pos-2", investedAmount: 500, expectedReturn: 560, yieldEarned: 10 }),
    ]);

    expect(summary.positionCount).toBe(2);
    expect(summary.totalInvested).toBe(1500);
    expect(summary.totalExpectedReturn).toBe(1660);
    expect(summary.totalYieldEarned).toBe(50);
  });

  it("weights APR by invested amount, not by position count", () => {
    const summary = summarisePositions([
      position({ investedAmount: 100_000, invoice: { terms: { apr: 6 } } }),
      position({ id: "b", investedAmount: 1_000, invoice: { terms: { apr: 20 } } }),
    ]);

    // A plain mean would say 13%, badly misrepresenting the book.
    expect(summary.weightedApr).toBeCloseTo(6.139, 2);
  });

  it("avoids divide-by-zero with no invested capital", () => {
    const summary = summarisePositions([position({ investedAmount: 0 })]);
    expect(summary.weightedApr).toBe(0);
  });

  it("coerces non-finite figures to zero", () => {
    const summary = summarisePositions([
      position({ investedAmount: Number.NaN, expectedReturn: Number.POSITIVE_INFINITY }),
    ]);
    expect(Number.isFinite(summary.totalInvested)).toBe(true);
    expect(Number.isFinite(summary.totalExpectedReturn)).toBe(true);
  });

  it("handles an empty portfolio", () => {
    expect(summarisePositions([]).positionCount).toBe(0);
  });
});

describe("digestTableHeaders", () => {
  it("drops redacted columns", () => {
    const headers = digestTableHeaders(positionsToExportRows([position()]));
    expect(headers).not.toContain("Transaction Hash");
    expect(headers).toContain("Invoice ID");
  });

  it("returns nothing for no rows", () => {
    expect(digestTableHeaders([])).toEqual([]);
  });
});

describe("buildDigestDocument", () => {
  const build = (filters: AnalyticsFilters = ALL_FILTERS, positions = [position()]) =>
    buildDigestDocument({
      positions,
      filters,
      formatCurrency: money,
      formatPercent: percent,
      now: new Date("2026-08-26T10:00:00.000Z"),
    });

  it("carries branded header fields", () => {
    const doc = build();
    expect(doc.title).toBe("Kora");
    expect(doc.subtitle).toBeTruthy();
    expect(doc.generatedAt).toBe("2026-08-26T10:00:00.000Z");
  });

  it("includes the key metrics", () => {
    const labels = build().sections[0].rows.map(([label]) => label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Positions",
        "Total invested",
        "Expected return",
        "Weighted average APR",
      ])
    );
  });

  it("never leaks a transaction hash into the table", () => {
    const doc = build();
    const flat = JSON.stringify(doc);
    // The hash is in the CSV export but must not reach a shareable digest.
    expect(flat).not.toContain("abc123secrethash");
    expect(doc.tableHeaders).not.toContain("Transaction Hash");
  });

  it("redacts every documented sensitive column", () => {
    const doc = build();
    for (const column of DIGEST_REDACTED_COLUMNS) {
      expect(doc.tableHeaders).not.toContain(column);
    }
  });

  it("respects the active risk-tier filter", () => {
    const positions = [position(), position({ id: "b", invoice: { riskTier: "CCC" } })];
    const doc = build({ ...ALL_FILTERS, riskTier: "AAA" }, positions);

    expect(doc.summary.positionCount).toBe(1);
    expect(doc.tableRows).toHaveLength(1);
  });

  it("respects the active jurisdiction filter", () => {
    const positions = [
      position(),
      position({ id: "b", invoice: { metadata: { jurisdiction: "EU" } } }),
    ];
    const doc = build({ ...ALL_FILTERS, jurisdiction: "US" }, positions);
    expect(doc.summary.positionCount).toBe(1);
  });

  it("summarises the filters in the header line", () => {
    const doc = build({ ...ALL_FILTERS, riskTier: "AAA", dateRange: "30d" });
    expect(doc.filterSummary).toContain("AAA");
    expect(doc.filterSummary).toContain("30d");
  });

  it("produces one table row per filtered position", () => {
    const doc = build(ALL_FILTERS, [position(), position({ id: "b" })]);
    expect(doc.tableRows).toHaveLength(2);
    expect(doc.tableRows[0]).toHaveLength(doc.tableHeaders.length);
  });

  it("survives an empty portfolio", () => {
    const doc = build(ALL_FILTERS, []);
    expect(doc.summary.positionCount).toBe(0);
    expect(doc.tableRows).toEqual([]);
    expect(doc.tableHeaders).toEqual([]);
  });

  it("always carries the disclaimer", () => {
    expect(build().disclaimer).toBe(DIGEST_DISCLAIMER);
  });
});

describe("describeFilters", () => {
  it("omits dimensions set to all", () => {
    expect(describeFilters(ALL_FILTERS)).toBe("Period: all");
  });

  it("lists the active dimensions", () => {
    const summary = describeFilters({
      riskTier: "AAA",
      jurisdiction: "US",
      category: "logistics",
      dateRange: "90d",
    });
    expect(summary).toContain("Risk tier: AAA");
    expect(summary).toContain("Jurisdiction: US");
    expect(summary).toContain("Category: logistics");
    expect(summary).toContain("Period: 90d");
  });
});

describe("digestFilename", () => {
  it("is dated and has no extension", () => {
    const name = digestFilename(new Date("2026-08-26T00:00:00.000Z"));
    expect(name).toBe("kora-portfolio-digest-2026-08-26");
    expect(name.endsWith(".pdf")).toBe(false);
  });
});

describe("buildDigestMailto", () => {
  const doc = buildDigestDocument({
    positions: [position()],
    filters: ALL_FILTERS,
    formatCurrency: money,
    formatPercent: percent,
    now: new Date("2026-08-26T10:00:00.000Z"),
  });

  it("builds a mailto with a dated subject", () => {
    const url = buildDigestMailto(doc, money);
    expect(url.startsWith("mailto:")).toBe(true);
    expect(decodeURIComponent(url)).toContain("2026-08-26");
  });

  it("carries a summary but no position rows", () => {
    const body = decodeURIComponent(buildDigestMailto(doc, money));
    expect(body).toContain("Positions: 1");
    // A mailto body lands in an outbox and any mail archive en route — the
    // position-level breakdown stays in the PDF on the user's device.
    expect(body).not.toContain("Acme");
    expect(body).not.toContain("abc123secrethash");
  });

  it("accepts an optional recipient", () => {
    expect(buildDigestMailto(doc, money, "a@b.com")).toContain("a%40b.com");
  });
});
