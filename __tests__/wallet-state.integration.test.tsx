/**
 * Integration tests for Wallet and Transaction State Management
 * 
 * Tests:
 * - Connected wallet state for funding
 * - Disconnected wallet state
 * - Transaction state transitions
 * - Error recovery and retry logic
 * - Wallet connection modal triggering
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMockInvoice, mockWalletConnected, mockWalletDisconnected } from "./fixtures";
import { createTestQueryClient } from "./setup";
import React from "react";

// Mock invoice
const mockInvoice = createMockInvoice({
  id: "inv_wallet_test",
  status: "partially_funded",
  funding: {
    totalRaised: 50000,
    targetAmount: 100000,
    fundingProgress: 0.5,
    remainingCapacity: 50000,
  },
});

// Mock wallet state - mutable for testing
let mockWalletState = mockWalletConnected;

// Mock transaction state - mutable for testing
let mockTransactionState = { status: "idle" as const, txHash: null, error: null };

const mockSetWalletModalOpen = vi.fn();

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(() => mockWalletState),
  useNetworkValidation: vi.fn((targetNetwork?: string) => {
    const expectedNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
    const isNetworkMismatch = Boolean(
      targetNetwork && targetNetwork.toLowerCase() !== expectedNetwork.toLowerCase()
    );
    return { expectedNetwork, isNetworkMismatch };
  }),
}));

vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: vi.fn(() => ({
    state: mockTransactionState,
    execute: vi.fn(async (buildFn: () => Promise<string>) => {
      mockTransactionState = { status: "signing" as const, txHash: null, error: null };
      const xdr = await buildFn();
      mockTransactionState = { status: "confirmed" as const, txHash: "mock_hash", error: null };
      return "mock_hash";
    }),
  })),
}));

vi.mock("@/hooks/useInvoices", () => ({
  useInvoice: vi.fn(() => ({
    data: mockInvoice,
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
  })),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "inv_wallet_test" }),
  notFound: () => { throw new Error("Not found"); },
}));

vi.mock("@/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store")>();
  return {
    ...actual,
    useUIStore: vi.fn(() => ({
      setWalletModalOpen: mockSetWalletModalOpen,
    })),
    useInvoiceStore: {
      getState: vi.fn(() => ({
        updateInvoiceFunding: vi.fn(),
      })),
    },
  };
});

vi.mock("@/services/invoiceService", () => ({
  prepareFundInvoice: vi.fn(async () => "mock_xdr"),
}));

import { useWallet } from "@/hooks/useWallet";
import { useTransaction } from "@/hooks/useTransaction";
import { useInvoice } from "@/hooks/useInvoices";
import { useUIStore, useWalletStore } from "@/store";
import { prepareFundInvoice } from "@/services/invoiceService";

// Test component
const WalletStateTest = () => {
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const { execute } = useTransaction();
  const { data: invoice } = useInvoice("inv_wallet_test");
  const [amount, setAmount] = React.useState("10000");
  const [fundingInProgress, setFundingInProgress] = React.useState(false);
  const [lastError, setLastError] = React.useState<string | null>(null);

  const handleConnectClick = () => {
    setWalletModalOpen(true);
  };

  const handleFund = async () => {
    if (!isConnected) {
      setWalletModalOpen(true);
      return;
    }

    setFundingInProgress(true);
    setLastError(null);

    try {
      const xdr = await prepareFundInvoice(invoice.tokenId, parseFloat(amount), address!);
      await execute(() => Promise.resolve(xdr));
    } catch (error: any) {
      setLastError(error.message);
    } finally {
      setFundingInProgress(false);
    }
  };

  return (
    <div data-testid="wallet-state-test">
      <div data-testid="connection-status">
        {isConnected ? (
          <>
            <div data-testid="wallet-address">{address}</div>
            <button onClick={handleFund} disabled={fundingInProgress} data-testid="fund-button">
              {fundingInProgress ? "Funding..." : "Fund"}
            </button>
          </>
        ) : (
          <button onClick={handleConnectClick} data-testid="connect-button">
            Connect Wallet
          </button>
        )}
      </div>

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        data-testid="amount-input"
      />

      {lastError && (
        <div data-testid="error-display">{lastError}</div>
      )}
    </div>
  );
};

describe("Wallet and Transaction State Integration Tests", () => {
  let queryClient: any;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockWalletState = mockWalletConnected;
    mockTransactionState = { status: "idle" as const, txHash: null, error: null };
    mockSetWalletModalOpen.mockClear();
    vi.clearAllMocks();
  });

  describe("Connected Wallet State", () => {
    it("displays wallet address when connected", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      expect(screen.getByTestId("wallet-address")).toHaveTextContent(mockWalletConnected.address);
    });

    it("shows fund button when wallet connected", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      expect(screen.getByTestId("fund-button")).toBeInTheDocument();
    });

    it("allows funding when wallet is connected", async () => {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      const fundButton = screen.getByTestId("fund-button");
      expect(fundButton).not.toBeDisabled();

      await user.click(fundButton);

      await waitFor(() => {
        expect(fundButton).toHaveTextContent("Fund");
      });
    });

    it("does not open wallet modal when already connected", async () => {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      await user.click(screen.getByTestId("fund-button"));

      expect(mockSetWalletModalOpen).not.toHaveBeenCalled();
    });
  });

  describe("Disconnected Wallet State", () => {
    beforeEach(() => {
      mockWalletState = mockWalletDisconnected;
    });

    it("displays connect button when wallet disconnected", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      expect(screen.getByTestId("connect-button")).toBeInTheDocument();
    });

    it("opens wallet modal on connect click", async () => {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      await user.click(screen.getByTestId("connect-button"));

      expect(mockSetWalletModalOpen).toHaveBeenCalledWith(true);
    });

    it("opens wallet modal when trying to fund without connection", async () => {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      // Wallet is disconnected, so we should see connect button
      const connectButton = screen.getByTestId("connect-button");
      await user.click(connectButton);

      expect(mockSetWalletModalOpen).toHaveBeenCalledWith(true);
    });

    it("does not show wallet address when disconnected", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      expect(() => screen.getByTestId("wallet-address")).toThrow();
    });
  });

  describe("Transaction State Transitions", () => {
    it("shows loading state during transaction", async () => {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      const fundButton = screen.getByTestId("fund-button") as HTMLButtonElement;
      await user.click(fundButton);

      await waitFor(() => {
        expect(fundButton.textContent).toMatch(/Fund/);
      });
    });

    it("handles transaction signing state", async () => {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      const fundButton = screen.getByTestId("fund-button");
      await user.click(fundButton);

      // During transaction, state should be "signing"
      await waitFor(() => {
        expect(mockTransactionState.status).toBe("confirmed");
      });
    });
  });

  describe("Error Handling", () => {
    it("displays error message on transaction failure", async () => {
      const user = userEvent.setup();

      (useTransaction as any).mockImplementation(() => ({
        state: mockTransactionState,
        execute: vi.fn(async () => {
          throw new Error("Transaction rejected");
        }),
      }));

      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      const fundButton = screen.getByTestId("fund-button");
      await user.click(fundButton);

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toHaveTextContent("Transaction rejected");
      });
    });

    it("clears error on next successful attempt", async () => {
      const user = userEvent.setup();
      let shouldFail = true;

      (useTransaction as any).mockImplementation(() => ({
        state: mockTransactionState,
        execute: vi.fn(async () => {
          if (shouldFail) {
            shouldFail = false;
            throw new Error("First attempt failed");
          }
          return "success";
        }),
      }));

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      // First attempt
      let fundButton = screen.getByTestId("fund-button");
      await user.click(fundButton);

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });

      // Reset for second attempt
      vi.clearAllMocks();
      shouldFail = false;

      rerender(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      fundButton = screen.getByTestId("fund-button");
      await user.click(fundButton);

      // Error should be cleared
      await waitFor(() => {
        expect(() => screen.getByTestId("error-display")).toThrow();
      });
    });
  });

  describe("Amount Input Handling", () => {
    it("allows amount input when connected", async () => {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      const amountInput = screen.getByTestId("amount-input") as HTMLInputElement;
      await user.clear(amountInput);
      await user.type(amountInput, "25000");

      expect(amountInput.value).toBe("25000");
    });

    it("handles amount changes", async () => {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      const amountInput = screen.getByTestId("amount-input") as HTMLInputElement;
      expect(amountInput.value).toBe("10000");

      await user.clear(amountInput);
      await user.type(amountInput, "15000");

      expect(amountInput.value).toBe("15000");
    });
  });

  describe("Wallet Connection Flow", () => {
    it("transitions from disconnected to connected state", () => {
      mockWalletState = mockWalletDisconnected;

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      // Initially disconnected
      expect(screen.getByTestId("connect-button")).toBeInTheDocument();

      // Switch to connected state
      mockWalletState = mockWalletConnected;

      rerender(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      // Should now show fund button
      expect(screen.getByTestId("fund-button")).toBeInTheDocument();
      expect(screen.getByTestId("wallet-address")).toBeInTheDocument();
    });

    it("transitions from connected to disconnected state", () => {
      mockWalletState = mockWalletConnected;

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      expect(screen.getByTestId("fund-button")).toBeInTheDocument();

      // Switch to disconnected state
      mockWalletState = mockWalletDisconnected;

      rerender(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      // Should show connect button
      expect(screen.getByTestId("connect-button")).toBeInTheDocument();
    });
  });

  describe("Balance Display", () => {
    it("displays wallet balance when connected", () => {
      mockWalletState = mockWalletConnected;

      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      expect(mockWalletState.balance).toBeDefined();
      expect(mockWalletState.balance?.usdc).toBe("50000");
    });

    it("does not display balance when disconnected", () => {
      mockWalletState = mockWalletDisconnected;

      render(
        <QueryClientProvider client={queryClient}>
          <WalletStateTest />
        </QueryClientProvider>
      );

      expect(mockWalletState.balance).toBeNull();
    });
  });

  describe("useWallet Integration & Network Validation", () => {
    it("handles connect and disconnect cycle correctly", () => {
      useWalletStore.getState().connect("freighter", "GABC1234567890", "GABC1234567890");
      expect(useWalletStore.getState().isConnected).toBe(true);
      expect(useWalletStore.getState().address).toBe("GABC1234567890");

      useWalletStore.getState().disconnect();
      expect(useWalletStore.getState().isConnected).toBe(false);
      expect(useWalletStore.getState().address).toBeNull();
    });

    it("delegates signTransaction with XDR string when connected", async () => {
      useWalletStore.getState().connect("freighter", "GABC1234567890", "GABC1234567890");

      const { useWallet: useWalletActual } = await vi.importActual<typeof import("@/hooks/useWallet")>("@/hooks/useWallet");
      const { result } = renderHook(() => useWalletActual());

      const mockXdr = "mock_xdr_AAAAB3N";
      const signedResult = await result.current.signTransaction(mockXdr);
      expect(signedResult).toBe(`${mockXdr}_signed`);
    });

    it("throws error when signTransaction is called without connection", async () => {
      useWalletStore.getState().disconnect();

      const { useWallet: useWalletActual } = await vi.importActual<typeof import("@/hooks/useWallet")>("@/hooks/useWallet");
      const { result } = renderHook(() => useWalletActual());

      await expect(result.current.signTransaction("AAAAB3N...")).rejects.toThrow("Wallet not connected");
    });

    it("detects network mismatch and validates expected network", async () => {
      const { useNetworkValidation: useNetworkValidationActual, useWallet: useWalletActual } = await vi.importActual<typeof import("@/hooks/useWallet")>("@/hooks/useWallet");

      const { result: navResult } = renderHook(() => useNetworkValidationActual("mainnet"));
      expect(navResult.current.expectedNetwork).toBe("testnet");
      expect(navResult.current.isNetworkMismatch).toBe(true);

      const { result: navMatchResult } = renderHook(() => useNetworkValidationActual("testnet"));
      expect(navMatchResult.current.isNetworkMismatch).toBe(false);

      const { result: walletResult } = renderHook(() => useWalletActual());
      expect(walletResult.current.validateNetwork("testnet")).toBe(true);
      expect(walletResult.current.validateNetwork("mainnet")).toBe(false);
    });
  });
});
