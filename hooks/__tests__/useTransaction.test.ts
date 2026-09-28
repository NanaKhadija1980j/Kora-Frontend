/**
 * Unit tests for hooks/useTransaction.ts
 *
 * Target: Full lifecycle coverage of transaction states
 * Tests cover: build → sign → submit → confirm → error → timeout flows
 *
 * Test coverage:
 * - Success flow: complete transaction lifecycle
 * - Sign rejection: user cancels wallet signature
 * - Submission error: network/RPC errors
 * - Confirmation timeout: transaction takes too long
 * - Sequence retry: handle sequence number conflicts
 * - TxState transitions: verify state changes at each step
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTransaction } from "../useTransaction";
import type { SimulationPreview } from "../useTransaction";

// Mock dependencies
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("../useToast", () => ({
  useToast: () => ({
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("../useWallet", () => ({
  useWallet: () => ({
    signTransaction: vi.fn(),
    publicKey: "GBTESTPUBLICKEYXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  }),
}));

vi.mock("@/lib/stellar/client", () => ({
  rpc: {
    getTransaction: vi.fn(),
    simulateTransaction: vi.fn(),
  },
  submitTransaction: vi.fn(),
  BadSequenceError: class BadSequenceError extends Error {},
  sequenceManager: { reset: vi.fn() },
}));

vi.mock("@/lib/stellar/contracts", () => ({
  parseSorobanError: (error: string) => {
    const match = error.match(/#(\d+)/);
    if (!match) return error;
    const codes: Record<number, string> = {
      4: "Unauthorized: caller is not the owner",
      3: "Insufficient balance",
    };
    const code = parseInt(match[1], 10);
    return codes[code] ?? `Contract error #${code}`;
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  },
}));

vi.mock("@/store/uiStore", () => ({
  useUIStore: () => ({
    setTxState: vi.fn(),
  }),
}));

vi.mock("@/store/transactionHistoryStore", () => ({
  useTransactionHistoryStore: () => ({
    addTransaction: vi.fn(),
    updateTransactionStatus: vi.fn(),
  }),
}));

vi.mock("@/lib/xdrDraftQueue", () => ({
  enqueueSignedXdr: vi.fn().mockResolvedValue({ id: "queued-draft-1" }),
  flushQueuedXdrDrafts: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
}));

vi.mock("../useNetworkStatus", () => ({
  useNetworkStatus: vi.fn(() => ({ isOnline: true })),
}));

// Mock a valid XDR transaction
const MOCK_UNSIGNED_XDR = "AAAAAgAAAABp6VSFhLT+HqAFwPp8rxdglLVKcYcuLcIJTEKq+YzNLgAAAGQABJv4AAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAGAAAAABHQNRXUV8yemtjS01WUkhRU0hMVjdLR0JQSzdJUllIQ1M3RUFEUEpJWVJFMlFVT1gzNUk0AAAACwAAABJjcmVhdGVfY29udHJhY3RfZnVuAAAAAAAABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

describe("useTransaction", () => {
  let mockSignTransaction: any;
  let mockSubmitTransaction: any;
  let mockGetTransaction: any;
  let mockSimulateTransaction: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    const { useWallet } = await import("../useWallet");
    const { submitTransaction, rpc } = await import("@/lib/stellar/client");

    mockSignTransaction = vi.fn();
    (useWallet as any).mockReturnValue({
      signTransaction: mockSignTransaction,
    });

    mockSubmitTransaction = submitTransaction as any;
    mockGetTransaction = rpc.getTransaction as any;
    mockSimulateTransaction = rpc.simulateTransaction as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Success Flow", () => {
    it("completes full transaction lifecycle", async () => {
      const signedXdr = "SIGNED_XDR_STRING";
      const txHash = "abc123def456";

      mockSignTransaction.mockResolvedValue(signedXdr);
      mockSubmitTransaction.mockResolvedValue({
        status: "PENDING",
        hash: txHash,
      });
      mockGetTransaction.mockResolvedValue({
        status: "SUCCESS",
      });

      // Mock successful simulation
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
        transactionData: {
          resources: () => ({
            instructions: () => 100,
            readBytes: () => 200,
            writeBytes: () => 300,
          }),
        },
      });

      const { result } = renderHook(() => useTransaction());

      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);
      const onSuccess = vi.fn();

      // Execute transaction
      const executePromise = act(async () => {
        return result.current.execute(buildFn, {
          onSuccess,
          successMessage: "Transaction confirmed!",
        });
      });

      // Wait for simulation
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Wait for polling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      const hash = await executePromise;

      expect(hash).toBe(txHash);
      expect(result.current.status).toBe("confirmed");
      expect(result.current.txHash).toBe(txHash);
      expect(onSuccess).toHaveBeenCalledWith(txHash);
      expect(buildFn).toHaveBeenCalledTimes(1);
      expect(mockSignTransaction).toHaveBeenCalledWith(MOCK_UNSIGNED_XDR);
      expect(mockSubmitTransaction).toHaveBeenCalledWith(signedXdr);
    });

    it("transitions through all states correctly", async () => {
      const signedXdr = "SIGNED_XDR";
      const txHash = "hash123";

      mockSignTransaction.mockResolvedValue(signedXdr);
      mockSubmitTransaction.mockResolvedValue({
        status: "PENDING",
        hash: txHash,
      });
      mockGetTransaction.mockResolvedValue({ status: "SUCCESS" });
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
      });

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const states: string[] = [];
      
      const executePromise = act(async () => {
        return result.current.execute(buildFn);
      });

      // Capture state transitions
      await act(async () => {
        states.push(result.current.status);
        await vi.advanceTimersByTimeAsync(100);
        states.push(result.current.status);
        await vi.advanceTimersByTimeAsync(1000);
        states.push(result.current.status);
      });

      await executePromise;
      states.push(result.current.status);

      expect(states).toContain("building");
      expect(states).toContain("simulating");
      expect(states).toContain("signing");
      expect(states).toContain("submitting");
      expect(states).toContain("polling");
      expect(states[states.length - 1]).toBe("confirmed");
    });

    it("handles mock XDR (bypasses simulation and network)", async () => {
      const mockXdr = "mock_test_xdr";
      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(mockXdr);

      const executePromise = act(async () => {
        return result.current.execute(buildFn);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      const hash = await executePromise;

      expect(hash).toBeTruthy();
      expect(hash).toHaveLength(64); // Mock hash is 64 hex chars
      expect(result.current.status).toBe("confirmed");
      expect(mockSimulateTransaction).not.toHaveBeenCalled();
      expect(mockSubmitTransaction).not.toHaveBeenCalled();
    });
  });

  describe("Sign Rejection", () => {
    it("fails when user rejects wallet signature", async () => {
      mockSignTransaction.mockRejectedValue(new Error("User rejected signature"));
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
      });

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);
      const onError = vi.fn();

      const executePromise = act(async () => {
        return result.current.execute(buildFn, { onError });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const hash = await executePromise;

      expect(hash).toBeNull();
      expect(result.current.status).toBe("failed");
      expect(result.current.error).toContain("User rejected signature");
      expect(onError).toHaveBeenCalled();
    });

    it("does not submit when signature fails", async () => {
      mockSignTransaction.mockRejectedValue(new Error("Signature failed"));
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
      });

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const executePromise = act(async () => {
        return result.current.execute(buildFn);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      await executePromise;

      expect(mockSubmitTransaction).not.toHaveBeenCalled();
    });
  });

  describe("Submission Error", () => {
    it("fails when submission returns ERROR status", async () => {
      mockSignTransaction.mockResolvedValue("SIGNED_XDR");
      mockSubmitTransaction.mockResolvedValue({
        status: "ERROR",
        error: "Network error",
      });
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
      });

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const executePromise = act(async () => {
        return result.current.execute(buildFn);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const hash = await executePromise;

      expect(hash).toBeNull();
      expect(result.current.status).toBe("failed");
    });

    it("does not poll when submission fails", async () => {
      mockSignTransaction.mockResolvedValue("SIGNED_XDR");
      mockSubmitTransaction.mockResolvedValue({ status: "ERROR" });
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
      });

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const executePromise = act(async () => {
        return result.current.execute(buildFn);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      await executePromise;

      expect(mockGetTransaction).not.toHaveBeenCalled();
    });

    it("retries once after tx_bad_seq and succeeds", async () => {
      const signedXdr = "SIGNED_XDR";
      const txHash = "retry-hash";

      mockSignTransaction.mockResolvedValue(signedXdr);
      mockSubmitTransaction
        .mockRejectedValueOnce(new (await import("@/lib/stellar/client")).BadSequenceError())
        .mockResolvedValue({ status: "PENDING", hash: txHash });
      mockGetTransaction.mockResolvedValue({ status: "SUCCESS" });
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
      });

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const executePromise = act(async () => {
        return result.current.execute(buildFn);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(1000);
      });

      const hash = await executePromise;

      expect(hash).toBe(txHash);
      expect(buildFn).toHaveBeenCalledTimes(2);
      expect(mockSignTransaction).toHaveBeenCalledTimes(2);
      expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
      expect(mockGetTransaction).toHaveBeenCalled();
    });
  });

  describe("Confirmation Timeout", () => {
    it("times out after 5 minutes", async () => {
      mockSignTransaction.mockResolvedValue("SIGNED_XDR");
      mockSubmitTransaction.mockResolvedValue({
        status: "PENDING",
        hash: "hash123",
      });
      mockGetTransaction.mockResolvedValue({ status: "NOT_FOUND" });
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
      });

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const executePromise = act(async () => {
        return result.current.execute(buildFn);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100); // simulation
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000); // 5min + buffer
      });

      const hash = await executePromise;

      expect(hash).toBeNull();
      expect(result.current.status).toBe("failed");
      expect(result.current.error).toContain("timed out");
    });

    it("uses exponential backoff for polling", async () => {
      mockSignTransaction.mockResolvedValue("SIGNED_XDR");
      mockSubmitTransaction.mockResolvedValue({
        status: "PENDING",
        hash: "hash123",
      });
      
      let pollCount = 0;
      mockGetTransaction.mockImplementation(() => {
        pollCount++;
        if (pollCount === 3) {
          return Promise.resolve({ status: "SUCCESS" });
        }
        return Promise.resolve({ status: "NOT_FOUND" });
      });

      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
      });

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const executePromise = act(async () => {
        return result.current.execute(buildFn);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100); // simulation
        await vi.advanceTimersByTimeAsync(1000); // 1st poll (1s delay)
        await vi.advanceTimersByTimeAsync(2000); // 2nd poll (2s delay)
        await vi.advanceTimersByTimeAsync(4000); // 3rd poll (4s delay)
      });

      const hash = await executePromise;

      expect(hash).toBe("hash123");
      expect(pollCount).toBe(3);
    });
  });

  describe("Simulation Preview", () => {
    it("calls onSimulationPreview with parsed preview", async () => {
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "5000",
        sorobanData: {
          resources: () => ({
            instructions: () => 12345,
            readBytes: () => 678,
            writeBytes: () => 910,
          }),
        },
      });

      const onSimulationPreview = vi.fn().mockResolvedValue(true); // user confirms

      mockSignTransaction.mockResolvedValue("SIGNED_XDR");
      mockSubmitTransaction.mockResolvedValue({
        status: "PENDING",
        hash: "hash123",
      });
      mockGetTransaction.mockResolvedValue({ status: "SUCCESS" });

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const executePromise = act(async () => {
        return result.current.execute(buildFn, { onSimulationPreview });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      await executePromise;

      expect(onSimulationPreview).toHaveBeenCalled();
      const preview = onSimulationPreview.mock.calls[0][0] as SimulationPreview;
      expect(preview.feeStroops).toBe(5000);
      expect(preview.feeXlm).toBeCloseTo(0.0005, 4);
      expect(preview.cpuInstructions).toBe(12345);
    });

    it("cancels execution when user rejects preview", async () => {
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
      });

      const onSimulationPreview = vi.fn().mockResolvedValue(false); // user cancels

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const executePromise = act(async () => {
        return result.current.execute(buildFn, { onSimulationPreview });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const hash = await executePromise;

      expect(hash).toBeNull();
      expect(result.current.status).toBe("idle");
      expect(mockSignTransaction).not.toHaveBeenCalled();
    });

    it("times out simulation after 10 seconds", async () => {
      mockSimulateTransaction.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 20000)) // never resolves in time
      );

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const executePromise = act(async () => {
        return result.current.execute(buildFn);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10100); // 10s + buffer
      });

      const hash = await executePromise;

      expect(hash).toBeNull();
      expect(result.current.status).toBe("failed");
      expect(result.current.error).toContain("timed out");
    });
  });

  describe("Reset", () => {
    it("resets state to idle", () => {
      const { result } = renderHook(() => useTransaction());

      // Manually set state to simulate a transaction
      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.txHash).toBeUndefined();
      expect(result.current.error).toBeUndefined();
      expect(result.current.simulationPreview).toBeNull();
    });
  });

  describe("Transaction History Integration", () => {
    it("adds transaction to history on submission", async () => {
      const { useTransactionHistoryStore } = await import("@/store/transactionHistoryStore");
      const mockAddTransaction = vi.fn();
      const mockUpdateStatus = vi.fn();

      (useTransactionHistoryStore as any).mockReturnValue({
        addTransaction: mockAddTransaction,
        updateTransactionStatus: mockUpdateStatus,
      });

      mockSignTransaction.mockResolvedValue("SIGNED_XDR");
      mockSubmitTransaction.mockResolvedValue({
        status: "PENDING",
        hash: "hash123",
      });
      mockGetTransaction.mockResolvedValue({ status: "SUCCESS" });
      mockSimulateTransaction.mockResolvedValue({
        results: [{ auth: [], xdr: "result-xdr" }],
        latestLedger: 1000,
        minResourceFee: "1000",
      });

      const { result } = renderHook(() => useTransaction());
      const buildFn = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);

      const executePromise = act(async () => {
        return result.current.execute(buildFn, {
          txType: "fund",
          txDescription: "Fund invoice #1",
          txAmount: "1000 USDC",
        });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(1000);
      });

      await executePromise;

      expect(mockAddTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: "hash123",
          type: "fund",
          status: "pending",
          description: "Fund invoice #1",
          amount: "1000 USDC",
        })
      );

      expect(mockUpdateStatus).toHaveBeenCalledWith("hash123", "confirmed");
    });
  });
});

// ─── Offline XDR Enqueue (#651) ───────────────────────────────────────────────

describe("Offline XDR enqueue", () => {
  let mockEnqueueSignedXdr: any;
  let mockUseNetworkStatus: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    const xdrQueue = await import("@/lib/xdrDraftQueue");
    mockEnqueueSignedXdr = xdrQueue.enqueueSignedXdr as any;

    const { useNetworkStatus } = await import("../useNetworkStatus");
    mockUseNetworkStatus = useNetworkStatus as any;
    mockUseNetworkStatus.mockReturnValue({ isOnline: true });

    const { useWallet } = await import("../useWallet");
    const { submitTransaction, rpc } = await import("@/lib/stellar/client");
    const mockSign = vi.fn().mockResolvedValue("SIGNED_XDR");
    (useWallet as any).mockReturnValue({
      signTransaction: mockSign,
      publicKey: "GTEST",
    });

    // By default simulate succeeds
    (rpc.simulateTransaction as any).mockResolvedValue({
      results: [{ auth: [], xdr: "result" }],
      latestLedger: 1000,
      minResourceFee: "100",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("enqueues the signed XDR when submitTransaction throws a network TypeError", async () => {
    const { submitTransaction } = await import("@/lib/stellar/client");

    // Simulate a fetch-level network failure AFTER signing
    (submitTransaction as any).mockRejectedValue(
      new TypeError("Failed to fetch")
    );

    const { result } = renderHook(() => useTransaction());
    const buildFn = vi.fn().mockResolvedValue("mock_unsigned");

    await act(async () => {
      await result.current.execute(buildFn, { txType: "fund" });
    });

    expect(mockEnqueueSignedXdr).toHaveBeenCalledOnce();
    expect(mockEnqueueSignedXdr).toHaveBeenCalledWith(
      expect.any(String), // signed XDR
      expect.objectContaining({ type: "fund" })
    );
  });

  it("does NOT enqueue when submitTransaction returns ERROR status (non-network failure)", async () => {
    const { submitTransaction } = await import("@/lib/stellar/client");

    // RPC responded with a contract/application-level error (not a network error)
    (submitTransaction as any).mockResolvedValue({ status: "ERROR", hash: "" });

    const { result } = renderHook(() => useTransaction());
    const buildFn = vi.fn().mockResolvedValue("mock_unsigned");

    await act(async () => {
      await result.current.execute(buildFn, { txType: "fund" });
    });

    expect(mockEnqueueSignedXdr).not.toHaveBeenCalled();
  });

  it("does NOT enqueue when the transaction is not yet signed (sign throws)", async () => {
    const { useWallet } = await import("../useWallet");
    (useWallet as any).mockReturnValue({
      signTransaction: vi.fn().mockRejectedValue(new Error("USER_REJECTED")),
      publicKey: "GTEST",
    });

    const { result } = renderHook(() => useTransaction());
    const buildFn = vi.fn().mockResolvedValue("mock_unsigned");

    await act(async () => {
      await result.current.execute(buildFn, { txType: "fund" });
    });

    expect(mockEnqueueSignedXdr).not.toHaveBeenCalled();
  });
});
