/**
 * Tests for portfolio export pipeline — Issues #223 / #387
 * Covers: CSV headers (incl. tx hash), live position rows, date-range +
 * metadata filter combinations, empty datasets, filename format.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportCsv } from "@/lib/export";
import {
  PORTFOLIO_EXPORT_HEADERS,
  filterPositionsForExport,
  positionToExportRow,
  positionsToExportRows,
  portfolioExportFilename,
  resolveDateRangeBounds,
} from "@/lib/portfolioExport";
import { DEFAULT_FILTERS, type AnalyticsFilters } from "@/components/analytics/AnalyticsFilterBar";
import type { InvestorPosition, Invoice } from "@/types/invoice";

// ─── DOM stubs ────────────────────────────────────────────────────────────────

let downloadedFilename = "";
let downloadedContent = "";

beforeEach(() => {
  downloadedFilename = "";
  downloadedContent = "";

  const mockLink = {
    href: "",
    download: "",
    style: { display: "" },
    click: vi.fn(),
  };

  vi.spyOn(document, "createElement").mockReturnValue(mockLink as any);
  vi.spyOn(document.body, "appendChild").mockImplementation(() => {
    downloadedFilename = mockLink.download;
    return mockLink as any;
  });
  vi.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as any);

  class MockBlob {
    type = "text/csv;charset=utf-8;";
    constructor(parts: string[]) {
      downloadedContent = parts[0];
    }
  }
  vi.stubGlobal("Blob", MockBlob);
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const HEADERS = [...PORTFOLIO_EXPORT_HEADERS];

function makeInvoice(overrides: Partial<Invoice> & { metadata?: Partial<Invoice["metadata"]>; terms?: Partial<Invoice["terms"]> } = {}): Invoice {
  const base = {
    id: "inv_001",
    tokenId: "1",
    contractAddress: "C...",
    ipfsCid: "bafy...",
    metadata: {
      invoiceNumber: "INV-001",
      issuerName: "Issuer",
      issuerAddress: "G...",
      debtorName: "Acme Corp",
      debtorAddress: "G...",
      amount: 100000,
      currency: "USDC" as const,
      issueDate: "2025-06-01T00:00:00.000Z",
      dueDate: "2025-09-01T00:00:00.000Z",
      description: "Goods",
      jurisdiction: "NG" as const,
      category: "manufacturing" as const,
      documentHash: "hash",
      documentUrl: "https://example.com",
      ...overrides.metadata,
    },
    terms: {
      discountRate: 0.05,
      apr: 12.5,
      financingAmount: 15000,
      minInvestment: 100,
      maxInvestment: 15000,
      tenor: 90,
      repaymentDate: "2025-09-01T00:00:00.000Z",
      ...overrides.terms,
    },
    funding: {
      totalRaised: 15000,
      targetAmount: 15000,
      fundingProgress: 1,
      investorCount: 1,
      remainingCapacity: 0,
    },
    riskTier: "A" as const,
    riskScore: 80,
    debtorPrivacy: "full" as const,
    status: "listed" as const,
    createdAt: "2025-06-01T00:00:00.000Z",
    updatedAt: "2025-06-01T00:00:00.000Z",
    ownerAddress: "G...",
    txHash: "abc123txhash",
    ...overrides,
  };
  return base as Invoice;
}

function makePosition(
  overrides: Partial<InvestorPosition> & { invoice?: Invoice } = {}
): InvestorPosition {
  return {
    id: "pos_001",
    invoiceId: "inv_001",
    invoice: overrides.invoice ?? makeInvoice(),
    investedAmount: 15000,
    expectedReturn: 15937.5,
    yieldEarned: 0,
    investedAt: "2025-07-10T00:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

const mockPositions = [
  {
    "Invoice ID": "INV-001",
    Debtor: "Acme Corp",
    "Face Value": 100000,
    "Funded Amount": 15000,
    APR: 12.5,
    "Maturity Date": "2025-09-01T00:00:00.000Z",
    Status: "active",
    "Expected Return": 15937.5,
    "Transaction Hash": "abc123txhash",
  },
  {
    "Invoice ID": "INV-002",
    Debtor: "Global Ltd",
    "Face Value": 200000,
    "Funded Amount": 50000,
    APR: 9.8,
    "Maturity Date": "2025-10-15T00:00:00.000Z",
    Status: "repaid",
    "Expected Return": 51225,
    "Transaction Hash": "def456txhash",
  },
];

const NOW = new Date("2025-07-20T12:00:00.000Z");

// ─── Legacy #223 CSV shape tests ──────────────────────────────────────────────

describe("exportCsv for investor portfolio (Issue #223 / #387)", () => {
  it("exports correct headers as first CSV row including Transaction Hash", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    const lines = downloadedContent.split("\n");
    expect(lines[0]).toBe(HEADERS.join(","));
    expect(lines[0]).toContain("Transaction Hash");
  });

  it("exports all required columns", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    const firstLine = downloadedContent.split("\n")[0];
    for (const col of HEADERS) {
      expect(firstLine).toContain(col);
    }
  });

  it("exports correct data rows with transaction hashes", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    const lines = downloadedContent.split("\n");
    expect(lines[1]).toBe(
      "INV-001,Acme Corp,100000,15000,12.5,2025-09-01T00:00:00.000Z,active,15937.5,abc123txhash"
    );
    expect(lines[2]).toBe(
      "INV-002,Global Ltd,200000,50000,9.8,2025-10-15T00:00:00.000Z,repaid,51225,def456txhash"
    );
  });

  it("exports headers-only when positions array is empty", () => {
    exportCsv([], "kora-portfolio-2025-07-01", HEADERS);
    const lines = downloadedContent.split("\n").filter(Boolean);
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe(HEADERS.join(","));
  });

  it("uses ISO 8601 date format in Maturity Date column", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    expect(downloadedContent).toContain("2025-09-01T00:00:00.000Z");
    expect(downloadedContent).toContain("2025-10-15T00:00:00.000Z");
  });

  it("names the file kora-portfolio-[YYYY-MM-DD].csv", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    expect(downloadedFilename).toBe("kora-portfolio-2025-07-01.csv");
  });

  it("appends .csv if missing from filename", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    expect(downloadedFilename).toMatch(/\.csv$/);
  });

  it("does not append double .csv extension", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01.csv", HEADERS);
    expect(downloadedFilename).toBe("kora-portfolio-2025-07-01.csv");
  });

  it("escapes values containing commas", () => {
    const data = [{ ...mockPositions[0], Debtor: "Acme, Corp" }];
    exportCsv(data, "test", HEADERS);
    expect(downloadedContent).toContain('"Acme, Corp"');
  });

  it("CSV snapshot matches expected output with tx hashes", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    const expected = [
      "Invoice ID,Debtor,Face Value,Funded Amount,APR,Maturity Date,Status,Expected Return,Transaction Hash",
      "INV-001,Acme Corp,100000,15000,12.5,2025-09-01T00:00:00.000Z,active,15937.5,abc123txhash",
      "INV-002,Global Ltd,200000,50000,9.8,2025-10-15T00:00:00.000Z,repaid,51225,def456txhash",
    ].join("\n");
    expect(downloadedContent).toBe(expected);
  });
});

// ─── Live position mapping (#387) ─────────────────────────────────────────────

describe("positionToExportRow (live data)", () => {
  it("maps a live InvestorPosition including tx hash", () => {
    const row = positionToExportRow(makePosition());
    expect(row).toEqual({
      "Invoice ID": "INV-001",
      Debtor: "Acme Corp",
      "Face Value": 100000,
      "Funded Amount": 15000,
      APR: 12.5,
      "Maturity Date": "2025-09-01T00:00:00.000Z",
      Status: "active",
      "Expected Return": 15937.5,
      "Transaction Hash": "abc123txhash",
    });
  });

  it("falls back gracefully when invoice metadata is missing", () => {
    const row = positionToExportRow(
      makePosition({
        invoice: undefined,
        invoiceId: "inv_orphan",
        investedAmount: 1000,
        expectedReturn: 1100,
      })
    );
    expect(row["Invoice ID"]).toBe("inv_orphan");
    expect(row.Debtor).toBe("");
    expect(row["Transaction Hash"]).toBe("");
  });

  it("builds dated filename via portfolioExportFilename", () => {
    expect(portfolioExportFilename(new Date("2025-07-01T15:00:00.000Z"))).toBe(
      "kora-portfolio-2025-07-01.csv"
    );
  });
});

// ─── Filter combinations (#387) ───────────────────────────────────────────────

describe("filterPositionsForExport", () => {
  const positions: InvestorPosition[] = [
    makePosition({
      id: "pos_a",
      investedAt: "2025-07-15T00:00:00.000Z",
      invoice: makeInvoice({
        riskTier: "A",
        metadata: { jurisdiction: "NG", category: "manufacturing", invoiceNumber: "INV-A" },
        txHash: "hash-a",
      }),
    }),
    makePosition({
      id: "pos_b",
      investedAt: "2025-06-01T00:00:00.000Z",
      invoice: makeInvoice({
        id: "inv_002",
        riskTier: "BBB",
        metadata: {
          jurisdiction: "KE",
          category: "retail",
          invoiceNumber: "INV-B",
          amount: 200000,
          debtorName: "Global Ltd",
        },
        terms: { apr: 9.8, repaymentDate: "2025-10-15T00:00:00.000Z" },
        txHash: "hash-b",
      }),
    }),
    makePosition({
      id: "pos_c",
      investedAt: "2025-07-18T00:00:00.000Z",
      invoice: makeInvoice({
        id: "inv_003",
        riskTier: "A",
        metadata: {
          jurisdiction: "NG",
          category: "retail",
          invoiceNumber: "INV-C",
          debtorName: "Retail Co",
        },
        txHash: "hash-c",
      }),
    }),
  ];

  it("returns all positions for default filters with dateRange=all", () => {
    const filters: AnalyticsFilters = { ...DEFAULT_FILTERS, dateRange: "all" };
    expect(filterPositionsForExport(positions, filters, NOW)).toHaveLength(3);
  });

  it("filters by 7d date range using investedAt", () => {
    const filters: AnalyticsFilters = { ...DEFAULT_FILTERS, dateRange: "7d" };
    const result = filterPositionsForExport(positions, filters, NOW);
    expect(result.map((p) => p.id)).toEqual(["pos_a", "pos_c"]);
  });

  it("filters by 30d date range", () => {
    const filters: AnalyticsFilters = { ...DEFAULT_FILTERS, dateRange: "30d" };
    const result = filterPositionsForExport(positions, filters, NOW);
    // pos_b invested 2025-06-01 is outside 30d from 2025-07-20
    expect(result.map((p) => p.id)).toEqual(["pos_a", "pos_c"]);
  });

  it("filters by 90d date range including older positions", () => {
    const filters: AnalyticsFilters = { ...DEFAULT_FILTERS, dateRange: "90d" };
    const result = filterPositionsForExport(positions, filters, NOW);
    expect(result.map((p) => p.id)).toEqual(["pos_a", "pos_b", "pos_c"]);
  });

  it("filters by custom date range", () => {
    const filters: AnalyticsFilters = {
      ...DEFAULT_FILTERS,
      dateRange: "custom",
      customDateRange: {
        from: new Date("2025-07-01T00:00:00.000Z"),
        to: new Date("2025-07-16T23:59:59.999Z"),
      },
    };
    const result = filterPositionsForExport(positions, filters, NOW);
    expect(result.map((p) => p.id)).toEqual(["pos_a"]);
  });

  it("filters by risk tier", () => {
    const filters: AnalyticsFilters = {
      ...DEFAULT_FILTERS,
      dateRange: "all",
      riskTier: "BBB",
    };
    const result = filterPositionsForExport(positions, filters, NOW);
    expect(result.map((p) => p.id)).toEqual(["pos_b"]);
  });

  it("filters by jurisdiction", () => {
    const filters: AnalyticsFilters = {
      ...DEFAULT_FILTERS,
      dateRange: "all",
      jurisdiction: "KE",
    };
    const result = filterPositionsForExport(positions, filters, NOW);
    expect(result.map((p) => p.id)).toEqual(["pos_b"]);
  });

  it("filters by category", () => {
    const filters: AnalyticsFilters = {
      ...DEFAULT_FILTERS,
      dateRange: "all",
      category: "retail",
    };
    const result = filterPositionsForExport(positions, filters, NOW);
    expect(result.map((p) => p.id)).toEqual(["pos_b", "pos_c"]);
  });

  it("combines risk + jurisdiction + date range", () => {
    const filters: AnalyticsFilters = {
      riskTier: "A",
      jurisdiction: "NG",
      category: "all",
      dateRange: "7d",
    };
    const result = filterPositionsForExport(positions, filters, NOW);
    expect(result.map((p) => p.id)).toEqual(["pos_a", "pos_c"]);
  });

  it("combines all filters including category", () => {
    const filters: AnalyticsFilters = {
      riskTier: "A",
      jurisdiction: "NG",
      category: "retail",
      dateRange: "7d",
    };
    const result = filterPositionsForExport(positions, filters, NOW);
    expect(result.map((p) => p.id)).toEqual(["pos_c"]);
  });

  it("returns empty array when no positions match (export should disable)", () => {
    const filters: AnalyticsFilters = {
      ...DEFAULT_FILTERS,
      dateRange: "all",
      riskTier: "AAA",
    };
    expect(filterPositionsForExport(positions, filters, NOW)).toEqual([]);
  });

  it("exports filtered live rows with tx hashes via positionsToExportRows", () => {
    const filters: AnalyticsFilters = {
      riskTier: "A",
      jurisdiction: "NG",
      category: "retail",
      dateRange: "7d",
    };
    const filtered = filterPositionsForExport(positions, filters, NOW);
    const rows = positionsToExportRows(filtered);
    exportCsv(rows as Record<string, unknown>[], portfolioExportFilename(NOW), HEADERS);

    expect(rows).toHaveLength(1);
    expect(rows[0]["Transaction Hash"]).toBe("hash-c");
    expect(downloadedContent).toContain("INV-C");
    expect(downloadedContent).toContain("hash-c");
    expect(downloadedContent).not.toContain("hash-a");
  });
});

describe("resolveDateRangeBounds", () => {
  it("returns null bounds for all", () => {
    expect(resolveDateRangeBounds("all", undefined, NOW)).toEqual({
      from: null,
      to: null,
    });
  });

  it("returns ytd from Jan 1", () => {
    const { from, to } = resolveDateRangeBounds("ytd", undefined, NOW);
    expect(from?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(to).not.toBeNull();
  });
});
