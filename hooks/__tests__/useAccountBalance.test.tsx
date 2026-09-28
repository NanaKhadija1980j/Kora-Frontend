/**
 * Unit tests for `hooks/useAccountBalance` — Issue #804.
 *
 * Covers visibility-aware refresh rules:
 * - Refreshes queries on 60s interval while the document is visible.
 * - Suppresses periodic refresh when document is hidden.
 * - Immediately refreshes when document transitions from hidden to visible.
 * - Does not refresh when document transitions from visible to hidden.
 * - No intervals or listeners attached when address is undefined.
 * - Cleans up interval and visibility event listeners on unmount.
 * - Maps raw balance data to legacy format and exposes query status flags.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_ENABLE_MOCK_DATA: false,
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  },
}));

vi.mock("@/hooks/useWalletBalances", () => ({
  useAccountBalanceQuery: vi.fn(),
}));

import { useAccountBalance, AUTO_REFRESH_INTERVAL } from "@/hooks/useAccountBalance";
import { useAccountBalanceQuery } from "@/hooks/useWalletBalances";
import { queryKeys } from "@/lib/queryKeys";

const TEST_ADDRESS = "GBQXFQ2PVCFP2LOJ3XPMBLM5R2LSCVJKGHGXAWWVQCLDWKZVKKPFDANJ";

const MOCK_RAW_BALANCES = {
  xlm: "125.5",
  usdc: "5000.25",
  otherAssets: [
    {
      code: "EURC",
      issuer: "MOCK_ISSUER",
      balance: "250.75",
    },
  ],
};

describe("useAccountBalance", () => {
  let queryClient: QueryClient;
  let originalVisibilityState: PropertyDescriptor | undefined;

  function setVisibilityState(state: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      writable: true,
      configurable: true,
    });
  }

  function createWrapper() {
    return function QueryWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    originalVisibilityState = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState"
    );
    setVisibilityState("visible");

    vi.mocked(useAccountBalanceQuery).mockReturnValue({
      data: MOCK_RAW_BALANCES,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
    vi.clearAllMocks();

    if (originalVisibilityState) {
      Object.defineProperty(document, "visibilityState", originalVisibilityState);
    } else {
      setVisibilityState("visible");
    }
  });

  it("refreshes queries every 60s while document is visible", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    setVisibilityState("visible");

    renderHook(() => useAccountBalance(TEST_ADDRESS), {
      wrapper: createWrapper(),
    });

    // Initial state: not called yet
    expect(invalidateSpy).not.toHaveBeenCalled();

    // Advance 60s
    act(() => {
      vi.advanceTimersByTime(AUTO_REFRESH_INTERVAL);
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.account.balances(TEST_ADDRESS),
    });

    // Advance another 60s
    act(() => {
      vi.advanceTimersByTime(AUTO_REFRESH_INTERVAL);
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it("does not refresh periodically when document is hidden", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    setVisibilityState("hidden");

    renderHook(() => useAccountBalance(TEST_ADDRESS), {
      wrapper: createWrapper(),
    });

    act(() => {
      vi.advanceTimersByTime(AUTO_REFRESH_INTERVAL * 3);
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("immediately refreshes when document transitions from hidden to visible", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    setVisibilityState("hidden");

    renderHook(() => useAccountBalance(TEST_ADDRESS), {
      wrapper: createWrapper(),
    });

    expect(invalidateSpy).not.toHaveBeenCalled();

    // Transition to visible and trigger visibilitychange
    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.account.balances(TEST_ADDRESS),
    });
  });

  it("does not refresh when document transitions from visible to hidden", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    setVisibilityState("visible");

    renderHook(() => useAccountBalance(TEST_ADDRESS), {
      wrapper: createWrapper(),
    });

    expect(invalidateSpy).not.toHaveBeenCalled();

    // Transition to hidden and trigger visibilitychange
    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("does not set up intervals or visibility listeners when address is undefined", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    setVisibilityState("visible");

    renderHook(() => useAccountBalance(undefined), {
      wrapper: createWrapper(),
    });

    act(() => {
      vi.advanceTimersByTime(AUTO_REFRESH_INTERVAL * 2);
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("cleans up interval and visibility listener on unmount", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    setVisibilityState("visible");

    const { unmount } = renderHook(() => useAccountBalance(TEST_ADDRESS), {
      wrapper: createWrapper(),
    });

    unmount();

    // Advancing timers or firing visibility events after unmount should not invalidate
    act(() => {
      vi.advanceTimersByTime(AUTO_REFRESH_INTERVAL * 2);
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("returns mapped legacy account balance and query states", () => {
    const mockRefetch = vi.fn();
    vi.mocked(useAccountBalanceQuery).mockReturnValue({
      data: MOCK_RAW_BALANCES,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    } as any);

    const { result } = renderHook(() => useAccountBalance(TEST_ADDRESS), {
      wrapper: createWrapper(),
    });

    expect(result.current.balance).toEqual({
      xlm: 125.5,
      usdc: 5000.25,
      eurc: 250.75,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.refetch).toBe(mockRefetch);
  });

  it("returns null balance when query data is absent", () => {
    vi.mocked(useAccountBalanceQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useAccountBalance(TEST_ADDRESS), {
      wrapper: createWrapper(),
    });

    expect(result.current.balance).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);
  });
});
