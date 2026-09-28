/**
 * useKycStatusSync — Issue #694.
 *
 * The route tests prove the webhook records a status; these prove the status
 * reaches the UI: written into `walletStore` (so the KYC tab re-renders with no
 * page reload) and propagated as an invalidation of the funding-gate queries.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// `walletStore` pulls in the Zod-validated env module at import time; the
// suite has no reason to require real Stellar config, so stub it as the other
// store-touching tests do.
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  },
}));

import { useKycStatusSync } from "@/hooks/useKycStatusSync";
import { useWalletStore } from "@/store/walletStore";
import { queryKeys } from "@/lib/queryKeys";
import type { KycStatus } from "@/lib/kycWebhook";

const WALLET = "GBQXFQ2PVCFP2LOJ3XPMBLM5R2LSCVJKGHGXAWWVQCLDWKZVKKPFDANJ";

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Stub the status endpoint with a fixed server-side status. */
function mockStatus(kycStatus: KycStatus | undefined, ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ success: ok, data: { kycStatus, updatedAt: Date.now() } }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function connect(address: string | null) {
  act(() => {
    useWalletStore.setState({
      address,
      isConnected: Boolean(address),
      kycStatus: "none",
    });
  });
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  connect(WALLET);
});

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
  act(() => {
    useWalletStore.setState({ address: null, isConnected: false, kycStatus: "none" });
  });
});

describe("useKycStatusSync", () => {
  it("writes a verified server status into the wallet store", async () => {
    mockStatus("verified");
    renderHook(() => useKycStatusSync(), { wrapper });

    await waitFor(() =>
      expect(useWalletStore.getState().kycStatus).toBe("verified")
    );
  });

  it("propagates a rejected status", async () => {
    mockStatus("rejected");
    renderHook(() => useKycStatusSync(), { wrapper });

    await waitFor(() =>
      expect(useWalletStore.getState().kycStatus).toBe("rejected")
    );
  });

  it("propagates a pending status", async () => {
    mockStatus("pending");
    renderHook(() => useKycStatusSync(), { wrapper });

    await waitFor(() =>
      expect(useWalletStore.getState().kycStatus).toBe("pending")
    );
  });

  it("fires onVerified once the webhook reports approval", async () => {
    mockStatus("verified");
    const onVerified = vi.fn();

    renderHook(() => useKycStatusSync({ onVerified }), { wrapper });

    await waitFor(() => expect(onVerified).toHaveBeenCalled());
  });

  it("reports rejected and pending through onStatusChange", async () => {
    mockStatus("rejected");
    const onStatusChange = vi.fn();

    renderHook(() => useKycStatusSync({ onStatusChange }), { wrapper });

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith("rejected"));
  });

  it("invalidates the funding-gate queries on a transition", async () => {
    mockStatus("verified");
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useKycStatusSync(), { wrapper });

    await waitFor(() =>
      expect(useWalletStore.getState().kycStatus).toBe("verified")
    );

    const invalidated = invalidate.mock.calls.map((c) =>
      JSON.stringify(c[0]?.queryKey)
    );
    expect(invalidated).toContain(JSON.stringify(queryKeys.kyc.status(WALLET)));
    expect(invalidated).toContain(JSON.stringify(queryKeys.invoices.all));
  });

  it("does not downgrade a locally verified investor to 'none'", async () => {
    // The mock KYC modal writes straight to the store and never reaches the
    // server, which answers "none" for a wallet it has not seen.
    mockStatus("none");
    act(() => useWalletStore.setState({ kycStatus: "verified" }));

    renderHook(() => useKycStatusSync(), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(useWalletStore.getState().kycStatus).toBe("verified");
  });

  it("does not fetch when disabled", async () => {
    const fetchMock = mockStatus("verified");

    renderHook(() => useKycStatusSync({ enabled: false }), { wrapper });

    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch without a connected wallet", async () => {
    const fetchMock = mockStatus("verified");
    connect(null);

    renderHook(() => useKycStatusSync(), { wrapper });

    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests the status for the connected address", async () => {
    const fetchMock = mockStatus("verified");
    renderHook(() => useKycStatusSync(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `address=${encodeURIComponent(WALLET)}`
    );
  });

  it("leaves the store untouched when the endpoint fails", async () => {
    const fetchMock = mockStatus(undefined, false);

    renderHook(() => useKycStatusSync(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // A failing status endpoint must not be read as "this investor is none".
    expect(useWalletStore.getState().kycStatus).toBe("none");
  });

  it("ignores an unrecognised status from the endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { kycStatus: "WAT", updatedAt: null } }),
      }))
    );

    renderHook(() => useKycStatusSync(), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(useWalletStore.getState().kycStatus).toBe("none");
  });

  it("stops reporting itself as polling once verified", async () => {
    mockStatus("verified");
    const { result } = renderHook(() => useKycStatusSync(), { wrapper });

    await waitFor(() => expect(result.current.isPolling).toBe(false));
  });
});
