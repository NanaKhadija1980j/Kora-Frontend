/**
 * Unit tests for `hooks/useKybStatusPoller` — Issue #803.
 *
 * Covers fake timers and mocked status endpoint until approved:
 * - Polls on fixed interval (KYC_POLL_INTERVAL_MS) while enabled is true.
 * - Suppresses polling and callback when enabled is false.
 * - Immediately fires onVerified if already verified on initial mount.
 * - Stops polling immediately once verified status is detected (clearInterval)
 *   and fires onVerified exactly once.
 * - Integrates with mocked /api/webhooks/kyc endpoint advancing until approved.
 * - Cleans up interval on unmount.
 * - Preserves fresh callback reference without re-triggering effect.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  },
}));

import { useKybStatusPoller } from "@/hooks/useKybStatusPoller";
import { useWalletStore } from "@/store/walletStore";
import { KYC_POLL_INTERVAL_MS } from "@/hooks/useKycStatusSync";

describe("useKybStatusPoller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useWalletStore.setState({
      kycStatus: "none",
      isConnected: true,
      address: "GBQXFQ2PVCFP2LOJ3XPMBLM5R2LSCVJKGHGXAWWVQCLDWKZVKKPFDANJ",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useWalletStore.setState({
      kycStatus: "none",
      isConnected: false,
      address: null,
    });
  });

  it("does not start polling or call onVerified when enabled is false", () => {
    const onVerified = vi.fn();
    renderHook(() => useKybStatusPoller({ enabled: false, onVerified }));

    act(() => {
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS * 5);
    });

    expect(onVerified).not.toHaveBeenCalled();
  });

  it("immediately fires onVerified and avoids polling if already verified on mount", () => {
    useWalletStore.setState({ kycStatus: "verified" });
    const onVerified = vi.fn();

    renderHook(() => useKybStatusPoller({ enabled: true, onVerified }));

    expect(onVerified).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS * 5);
    });

    // Should not fire again on subsequent intervals
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("polls on interval until approved, stops polling, and fires onVerified once", () => {
    const onVerified = vi.fn();
    renderHook(() => useKybStatusPoller({ enabled: true, onVerified }));

    // Tick 1: status is "none"
    act(() => {
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS);
    });
    expect(onVerified).not.toHaveBeenCalled();

    // Tick 2: status is "pending"
    act(() => {
      useWalletStore.setState({ kycStatus: "pending" });
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS);
    });
    expect(onVerified).not.toHaveBeenCalled();

    // Tick 3: status flips to "verified" (approved)
    act(() => {
      useWalletStore.setState({ kycStatus: "verified" });
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS);
    });
    expect(onVerified).toHaveBeenCalledTimes(1);

    // Further ticks: polling must have stopped (clearInterval was called)
    act(() => {
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS * 10);
    });
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("integrates with mocked status endpoint until approved", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount++;
      // Return pending for first 2 polls, then approved / verified
      const kycStatus = callCount >= 3 ? "verified" : "pending";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { kycStatus, updatedAt: Date.now() },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const onVerified = vi.fn();
    renderHook(() => useKybStatusPoller({ enabled: true, onVerified }));

    // Simulate status endpoint poller synchronizing status to wallet store
    const pollStatusEndpoint = async () => {
      const res = await fetch("/api/webhooks/kyc?address=test");
      const json = await res.json();
      useWalletStore.setState({ kycStatus: json.data.kycStatus });
    };

    // Poll 1: endpoint returns pending
    await pollStatusEndpoint();
    act(() => {
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS);
    });
    expect(useWalletStore.getState().kycStatus).toBe("pending");
    expect(onVerified).not.toHaveBeenCalled();

    // Poll 2: endpoint still pending
    await pollStatusEndpoint();
    act(() => {
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS);
    });
    expect(useWalletStore.getState().kycStatus).toBe("pending");
    expect(onVerified).not.toHaveBeenCalled();

    // Poll 3: endpoint returns verified (approved)
    await pollStatusEndpoint();
    expect(useWalletStore.getState().kycStatus).toBe("verified");
    act(() => {
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS);
    });
    expect(onVerified).toHaveBeenCalledTimes(1);

    // Poller has stopped on approved: subsequent ticks do not fire onVerified again
    act(() => {
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS * 5);
    });
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("cleans up interval timer on unmount", () => {
    const onVerified = vi.fn();
    const { unmount } = renderHook(() =>
      useKybStatusPoller({ enabled: true, onVerified })
    );

    unmount();

    act(() => {
      useWalletStore.setState({ kycStatus: "verified" });
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS * 5);
    });

    expect(onVerified).not.toHaveBeenCalled();
  });

  it("stops polling when enabled changes to false", () => {
    const onVerified = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useKybStatusPoller({ enabled, onVerified }),
      { initialProps: { enabled: true } }
    );

    rerender({ enabled: false });

    act(() => {
      useWalletStore.setState({ kycStatus: "verified" });
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS * 5);
    });

    expect(onVerified).not.toHaveBeenCalled();
  });

  it("always invokes the freshest onVerified callback without restarting polling", () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    const { rerender } = renderHook(
      ({ onVerified }) => useKybStatusPoller({ enabled: true, onVerified }),
      { initialProps: { onVerified: firstCallback } }
    );

    rerender({ onVerified: secondCallback });

    act(() => {
      useWalletStore.setState({ kycStatus: "verified" });
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS);
    });

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
  });

  it("does not call onVerified when transitioning between unverified states", () => {
    const onVerified = vi.fn();
    renderHook(() => useKybStatusPoller({ enabled: true, onVerified }));

    act(() => {
      useWalletStore.setState({ kycStatus: "rejected" });
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS);
    });
    expect(onVerified).not.toHaveBeenCalled();

    act(() => {
      useWalletStore.setState({ kycStatus: "none" });
      vi.advanceTimersByTime(KYC_POLL_INTERVAL_MS);
    });
    expect(onVerified).not.toHaveBeenCalled();
  });
});
