import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useTransactionHistoryStore } from "@/store/transactionHistoryStore";
import { exportCsv } from "@/lib/export";

// ── Mock env validation before any imports that trigger it ────────────────────
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  },
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(),
}));

vi.mock("@/lib/export", () => ({
  exportCsv: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  safeStellarTxUrl: (hash: string) =>
    `https://stellar.expert/explorer/testnet/tx/${hash}`,
}));

// Import after mocks are declared
import TransactionHistoryPage from "../page";
import { useWallet } from "@/hooks/useWallet";

describe("TransactionHistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTransactionHistoryStore.setState({
      transactions: [],
      filterType: "all",
      filterStartDate: null,
      filterEndDate: null,
    });
  });

  it("renders Connect Wallet screen when disconnected", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: false,
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as any);

    render(<TransactionHistoryPage />);

    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("renders transaction list and handles empty state when connected", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
      address: "GTEST123",
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as any);

    render(<TransactionHistoryPage />);

    expect(screen.getByText("Transaction History")).toBeInTheDocument();
    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
  });

  it("filters transactions by type and triggers CSV export", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
      address: "GTEST123",
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as any);

    // Populate store with fake transactions
    useTransactionHistoryStore.setState({
      transactions: [
        {
          hash: "hash_mint",
          type: "mint_invoice",
          status: "confirmed",
          amount: "100",
          assetCode: "USDC",
          timestamp: new Date("2026-07-28T12:00:00Z").getTime(),
          description: "Mint #1",
          invoiceId: "INV-001",
        },
        {
          hash: "hash_fund",
          type: "fund_invoice",
          status: "confirmed",
          amount: "200",
          assetCode: "USDC",
          timestamp: new Date("2026-07-29T12:00:00Z").getTime(),
          description: "Fund #1",
          invoiceId: "INV-002",
        },
      ],
      filterType: "all",
      filterStartDate: null,
      filterEndDate: null,
    });

    render(<TransactionHistoryPage />);

    // Both transactions visible initially
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("INV-002")).toBeInTheDocument();

    // Filter to Mints only
    const mintsButton = screen.getByRole("button", { name: /^mints$/i });
    fireEvent.click(mintsButton);

    // Only mint transaction visible
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.queryByText("INV-002")).not.toBeInTheDocument();

    // Trigger CSV export
    const exportButton = screen.getByRole("button", { name: /export csv/i });
    fireEvent.click(exportButton);

    expect(exportCsv).toHaveBeenCalledTimes(1);
    const exportedRows = vi.mocked(exportCsv).mock.calls[0][0];
    expect(exportedRows).toHaveLength(1);
    expect(exportedRows[0].hash).toBe("hash_mint");
  });
});
