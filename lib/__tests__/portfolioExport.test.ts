/**
 * Tests for CSV portfolio export — Issue #223
 * Covers: column headers, data rows, empty positions, ISO 8601 dates, filename format
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportCsv } from "@/lib/export";

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

const HEADERS = [
  "Invoice ID",
  "Debtor",
  "Face Value",
  "Funded Amount",
  "APR",
  "Maturity Date",
  "Status",
  "Expected Return",
];

const mockPositions = [
  {
    "Invoice ID": "INV-001",
    "Debtor": "Acme Corp",
    "Face Value": 100000,
    "Funded Amount": 15000,
    "APR": 12.5,
    "Maturity Date": "2025-09-01T00:00:00.000Z",
    "Status": "active",
    "Expected Return": 15937.5,
  },
  {
    "Invoice ID": "INV-002",
    "Debtor": "Global Ltd",
    "Face Value": 200000,
    "Funded Amount": 50000,
    "APR": 9.8,
    "Maturity Date": "2025-10-15T00:00:00.000Z",
    "Status": "repaid",
    "Expected Return": 51225,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("exportCsv for investor portfolio (Issue #223)", () => {
  it("exports correct headers as first CSV row", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    const lines = downloadedContent.split("\n");
    expect(lines[0]).toBe(HEADERS.join(","));
  });

  it("exports all 8 required columns", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    const firstLine = downloadedContent.split("\n")[0];
    for (const col of HEADERS) {
      expect(firstLine).toContain(col);
    }
  });

  it("exports correct data rows", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    const lines = downloadedContent.split("\n");
    expect(lines[1]).toBe("INV-001,Acme Corp,100000,15000,12.5,2025-09-01T00:00:00.000Z,active,15937.5");
    expect(lines[2]).toBe("INV-002,Global Ltd,200000,50000,9.8,2025-10-15T00:00:00.000Z,repaid,51225");
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

  it("CSV snapshot matches expected output", () => {
    exportCsv(mockPositions, "kora-portfolio-2025-07-01", HEADERS);
    const expected = [
      "Invoice ID,Debtor,Face Value,Funded Amount,APR,Maturity Date,Status,Expected Return",
      "INV-001,Acme Corp,100000,15000,12.5,2025-09-01T00:00:00.000Z,active,15937.5",
      "INV-002,Global Ltd,200000,50000,9.8,2025-10-15T00:00:00.000Z,repaid,51225",
    ].join("\n");
    expect(downloadedContent).toBe(expected);
  });
});
