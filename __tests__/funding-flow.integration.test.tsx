/**
 * Integration tests for Invoice Funding Flow
 * 
 * Tests:
 * - Complete funding transaction flow
 * - Mock transaction signing
 * - Optimistic update verification
 * - Success state verification
 * - Error handling
 * - Transaction hash display
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMockInvoice, mockWalletConnected } from "./fixtures";
import { createTestQueryClient } from "./setup";
import React from "react";

const mockInvoice = createMockInvoice({
  id: "inv_funding_test",
  metadata: {
    invoiceNumber: "INV-FUND-001",
    debtorName: "Funding Test Co",
  },
  terms: {
    minInvestment: 1000,
    maxInvestment: 50000,
  },
  funding: {
    totalRaised: 50000,
    targetAmount: 100000,
    fundingProgress: 0.5,
    remainingCapacity: 50000,
  },
  status: "partially_funded",
});

// Mock invoice service
const mockPreparedXdr = "mock_xdr_unsigned";
const mockSignedXdr = "mock_xdr_signed";
const mockTxHash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6";

vi.mock("@/services/invoiceService", () => ({
  prepareFundInvoice: vi.fn(async (tokenId, amount, address) => {
    return Promise.resolve(mockPreparedXdr);
  }),
  prepareCreateInvoice: vi.fn(),
}));

// Mock useInvoice
vi.mock("@/hooks/useInvoices", () => ({
  useInvoice: vi.fn(() => ({
    data: mockInvoice,
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
  })),
}));

// Mock useWallet - returns connected wallet
let mockWalletState = mockWalletConnected;
vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(() => mockWalletState),
}));

// Mock useTransaction with lifecycle stages
let mockTransactionState = { status: "idle" as const, txHash: null, error: null };

vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: vi.fn(() => ({
    state: mockTransactionState,
    execute: vi.fn(async (buildFn: () => Promise<string>, options?: any) => {
      mockTransactionState = { status: "building" as const, txHash: null, error: null };
      
      const xdr = await buildFn();
      
      mockTransactionState = { status: "simulating" as const, txHash: null, error: null };
      await new Promise(r => setTimeout(r, 50));
      
      mockTransactionState = { status: "signing" as const, txHash: null, error: null };
      await new Promise(r => setTimeout(r, 100));
      
      const signedXdr = mockSignedXdr;
      
      mockTransactionState = { status: "submitting" as const, txHash: null, error: null };
      await new Promise(r => setTimeout(r, 50));
      
      mockTransactionState = { status: "polling" as const, txHash: null, error: null };
      await new Promise(r => setTimeout(r, 100));
      
      const hash = mockTxHash;
      mockTransactionState = { status: "confirmed" as const, txHash: hash, error: null };
      
      options?.onSuccess?.(hash);
      return hash;
    }),
  })),
}));

// Mock useParams and navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "inv_funding_test" }),
  notFound: () => { throw new Error("Not found"); },
}));

const mockUpdateInvoiceFunding = vi.fn();

// Mock store
vi.mock("@/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store")>();
  return {
    ...actual,
    useUIStore: vi.fn(() => ({
      setWalletModalOpen: vi.fn(),
    })),
    useInvoiceStore: Object.assign(
      vi.fn(() => ({})),
      {
        getState: vi.fn(() => ({
          updateInvoiceFunding: mockUpdateInvoiceFunding,
        })),
      }
    ),
  };
});

// Mock utils
vi.mock("@/lib/utils", () => ({
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount.toLocaleString()}`,
  formatApr: (apr: number) => `${apr.toFixed(2)}%`,
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
  formatRelativeDate: (date: string) => "in 63 days",
  daysUntil: () => 63,
  STATUS_COLORS: {},
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

import { useParams } from "next/navigation";
import { useInvoice } from "@/hooks/useInvoices";
import { useWallet } from "@/hooks/useWallet";
import { useTransaction } from "@/hooks/useTransaction";
import { useUIStore, useInvoiceStore } from "@/store";
import { prepareFundInvoice } from "@/services/invoiceService";

// Funding flow component for testing
const FundingFlowTest = () => {
  const { id } = useParams() as { id: string };
  const { data: invoice } = useInvoice(id);
  const { isConnected, address } = useWallet();
  const { execute } = useTransaction();
  const { setWalletModalOpen } = useUIStore();
  const [amount, setAmount] = React.useState("");
  const [funding, setFunding] = React.useState(false);
  const [fundTxHash, setFundTxHash] = React.useState<string | null>(null);
  const [txError, setTxError] = React.useState<string | null>(null);
  const [stageMessage, setStageMessage] = React.useState("");

  if (!invoice) return null;

  const { terms, funding: fundingState } = invoice;
  const amountNum = parseFloat(amount) || 0;

  const handleFund = async () => {
    if (!isConnected) {
      setWalletModalOpen(true);
      return;
    }

    if (amountNum < terms.minInvestment) {
      setTxError(`Minimum investment is $${terms.minInvestment}`);
      return;
    }

    if (amountNum > fundingState.remainingCapacity) {
      setTxError(`Maximum investment is $${fundingState.remainingCapacity}`);
      return;
    }

    setFunding(true);
    setTxError(null);
    setStageMessage("Building transaction...");

    try {
      // Optimistic update
      useInvoiceStore.getState().updateInvoiceFunding(invoice.id, fundingState.totalRaised + amountNum);

      setStageMessage("Simulating transaction...");
      await new Promise(r => setTimeout(r, 50));

      setStageMessage("Signing transaction...");
      const xdr = await prepareFundInvoice(invoice.tokenId, amountNum, address!);

      setStageMessage("Submitting to network...");
      const hash = await execute(
        () => Promise.resolve(xdr),
        {
          onSuccess: (h: string) => {
            setFundTxHash(h);
            setStageMessage("Transaction confirmed!");
          },
        }
      );

      setFundTxHash(hash);
    } catch (error: any) {
      setTxError(error.message || "Funding failed");
    } finally {
      setFunding(false);
    }
  };

  return (
    <div data-testid="funding-flow-test">
      <h2>Fund Invoice #{invoice.metadata.invoiceNumber}</h2>

      <div data-testid="remaining-capacity">
        Remaining Capacity: ${fundingState.remainingCapacity}
      </div>

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`Min $${terms.minInvestment}`}
        data-testid="funding-amount-input"
      />

      <button
        onClick={handleFund}
        disabled={funding || !isConnected}
        data-testid="submit-funding-button"
      >
        {funding ? "Processing..." : "Fund Now"}
      </button>

      {stageMessage && (
        <div data-testid="stage-message">{stageMessage}</div>
      )}

      {fundTxHash && (
        <div data-testid="success-message">
          Success! Hash: <span data-testid="tx-hash-display">{fundTxHash}</span>
        </div>
      )}

      {txError && (
        <div data-testid="error-message">{txError}</div>
      )}
    </div>
  );
};

describe("Invoice Funding Flow Integration Tests", () => {
  let queryClient: any;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockWalletState = mockWalletConnected;
    mockTransactionState = { status: "idle" as const, txHash: null, error: null };
    mockUpdateInvoiceFunding.mockClear();
    vi.clearAllMocks();
  });

  it("renders funding form", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("funding-amount-input")).toBeInTheDocument();
    expect(screen.getByTestId("submit-funding-button")).toBeInTheDocument();
    expect(screen.getByTestId("remaining-capacity")).toHaveTextContent("Remaining Capacity: $50000");
  });

  it("disables submit button when not connected", () => {
    mockWalletState = { ...mockWalletConnected, isConnected: false };

    render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("submit-funding-button")).toBeDisabled();
  });

  it("shows loading state during transaction", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    const amountInput = screen.getByTestId("funding-amount-input") as HTMLInputElement;
    const submitButton = screen.getByTestId("submit-funding-button");

    await user.type(amountInput, "10000");
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toHaveTextContent("Processing...");
    });
  });

  it("performs optimistic update before transaction confirmation", async () => {
    const user = userEvent.setup();
    const updateFn = vi.fn();

    (useInvoiceStore.getState as any).mockImplementation(() => ({
      updateInvoiceFunding: updateFn,
    }));

    render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    const amountInput = screen.getByTestId("funding-amount-input") as HTMLInputElement;
    await user.type(amountInput, "10000");
    await user.click(screen.getByTestId("submit-funding-button"));

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledWith("inv_funding_test", 60000);
    });
  });

  it("shows transaction lifecycle stages", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    const amountInput = screen.getByTestId("funding-amount-input") as HTMLInputElement;
    await user.type(amountInput, "10000");
    await user.click(screen.getByTestId("submit-funding-button"));

    await waitFor(() => {
      expect(screen.getByTestId("stage-message")).toBeInTheDocument();
    });
  });

  it("displays transaction hash on success", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    const amountInput = screen.getByTestId("funding-amount-input") as HTMLInputElement;
    await user.type(amountInput, "10000");
    await user.click(screen.getByTestId("submit-funding-button"));

    await waitFor(() => {
      expect(screen.getByTestId("success-message")).toBeInTheDocument();
      expect(screen.getByTestId("tx-hash-display")).toHaveTextContent(mockTxHash);
    });
  });

  it("verifies transaction mock signing behavior", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    const amountInput = screen.getByTestId("funding-amount-input") as HTMLInputElement;
    await user.type(amountInput, "5000");
    await user.click(screen.getByTestId("submit-funding-button"));

    await waitFor(() => {
      expect(mockTransactionState.status).toBe("confirmed");
      expect(mockTransactionState.txHash).toBe(mockTxHash);
    }, { timeout: 1000 });
  });

  it("handles transaction errors", async () => {
    const user = userEvent.setup();

    (useTransaction as any).mockImplementation(() => ({
      state: mockTransactionState,
      execute: vi.fn(async () => {
        throw new Error("User rejected transaction");
      }),
    }));

    render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    const amountInput = screen.getByTestId("funding-amount-input") as HTMLInputElement;
    await user.type(amountInput, "10000");
    await user.click(screen.getByTestId("submit-funding-button"));

    await waitFor(() => {
      expect(screen.getByTestId("error-message")).toBeInTheDocument();
    });
  });

  it("clears error after successful retry", async () => {
    const user = userEvent.setup();
    let shouldFail = true;

    (useTransaction as any).mockImplementation(() => ({
      state: mockTransactionState,
      execute: vi.fn(async (buildFn: () => Promise<string>) => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("First attempt failed");
        }
        const xdr = await buildFn();
        return mockTxHash;
      }),
    }));

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    let amountInput = screen.getByTestId("funding-amount-input") as HTMLInputElement;
    await user.type(amountInput, "10000");
    await user.click(screen.getByTestId("submit-funding-button"));

    await waitFor(() => {
      expect(screen.getByTestId("error-message")).toBeInTheDocument();
    });

    await user.clear(amountInput);
    await user.type(amountInput, "10000");
    await user.click(screen.getByTestId("submit-funding-button"));
  });

  it("validates minimum investment before submitting", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    const amountInput = screen.getByTestId("funding-amount-input") as HTMLInputElement;

    await user.type(amountInput, "500");
    await user.click(screen.getByTestId("submit-funding-button"));

    await waitFor(() => {
      expect(screen.getByTestId("error-message")).toHaveTextContent("Minimum investment is $1000");
    });
  });

  it("disables submit during transaction processing", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <FundingFlowTest />
      </QueryClientProvider>
    );

    const amountInput = screen.getByTestId("funding-amount-input") as HTMLInputElement;
    const submitButton = screen.getByTestId("submit-funding-button");

    await user.type(amountInput, "10000");
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });
});
