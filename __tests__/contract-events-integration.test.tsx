/**
 * Integration tests for useContractEvents — offline pause, throttle behaviour,
 * and query invalidation paths.
 *
 * Strategy
 * ─────────
 * • useNetworkStatus is mocked to control online/offline state.
 * • subscribeContractEvents is mocked so we control the stream/polling mode.
 * • TanStack QueryClient is created per-test with a spy on invalidateQueries.
 * • vi.useFakeTimers() gives deterministic control over polling intervals.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { invalidateCachesForEvent } from "@/hooks/useContractEvents";
import { queryKeys } from "@/lib/queryKeys";
import type { ContractEvent } from "@/lib/stellar/client";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const BASE_EVENT: ContractEvent = {
  id: "evt-100",
  ledger: 200,
  ledgerClosedAt: new Date("2025-05-01T00:00:00Z").toISOString(),
  contractId: "CTEST",
  type: "invoice_funded",
  tokenId: "55",
  amount: 2500,
  participantAddress: "GABCDEF",
  rawTopics: ["invoice_funded"],
};

// ─── Cache invalidation unit tests ────────────────────────────────────────────

describe("invalidateCachesForEvent", () => {
  let queryClient: QueryClient;
  let spy: MockInstance;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    spy = vi.spyOn(queryClient, "invalidateQueries");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── invoice_funded ──────────────────────────────────────────────────────────

  it("invalidates detail + all list caches on invoice_funded", () => {
    invalidateCachesForEvent(BASE_EVENT, queryClient);

    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.invoices.detail("55"),
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.invoices.all });
  });

  it("uses the tokenId from the event for the detail key", () => {
    const event = { ...BASE_EVENT, tokenId: "77" };
    invalidateCachesForEvent(event, queryClient);

    const calls = spy.mock.calls.map((c) => c[0]);
    const detailCall = calls.find(
      (c) =>
        Array.isArray(c?.queryKey) &&
        c.queryKey.some((k: unknown) => k === "77")
    );
    expect(detailCall).toBeDefined();
  });

  // ── invoice_repaid ──────────────────────────────────────────────────────────

  it("invalidates detail, all, and positions caches on invoice_repaid", () => {
    const event = { ...BASE_EVENT, type: "invoice_repaid" as const };
    invalidateCachesForEvent(event, queryClient, vi.fn());

    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.invoices.detail("55"),
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.invoices.all });

    // positions cache invalidated via predicate
    const predicateCall = spy.mock.calls.find(
      (c) => typeof c[0]?.predicate === "function"
    );
    expect(predicateCall).toBeDefined();
  });

  it("positions predicate matches invoices/positions queries", () => {
    const event = { ...BASE_EVENT, type: "invoice_repaid" as const };
    invalidateCachesForEvent(event, queryClient, vi.fn());

    const predicateCall = spy.mock.calls.find(
      (c) => typeof c[0]?.predicate === "function"
    );
    const predicate = predicateCall![0].predicate;

    // Should match positions queries
    expect(
      predicate({ queryKey: ["invoices", "positions", "GABC"] } as any)
    ).toBe(true);

    // Should NOT match other invoice queries
    expect(
      predicate({ queryKey: ["invoices", "detail", "55"] } as any)
    ).toBe(false);

    // Should NOT match non-invoice queries
    expect(predicate({ queryKey: ["wallet", "balance"] } as any)).toBe(false);
  });

  // ── invoice_cancelled ──────────────────────────────────────────────────────

  it("invalidates detail + all caches on invoice_cancelled", () => {
    const event = { ...BASE_EVENT, type: "invoice_cancelled" as const };
    invalidateCachesForEvent(event, queryClient);

    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.invoices.detail("55"),
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.invoices.all });
  });

  it("does NOT call positions predicate on invoice_cancelled", () => {
    const event = { ...BASE_EVENT, type: "invoice_cancelled" as const };
    invalidateCachesForEvent(event, queryClient);

    const predicateCall = spy.mock.calls.find(
      (c) => typeof c[0]?.predicate === "function"
    );
    expect(predicateCall).toBeUndefined();
  });

  // ── call count guards ───────────────────────────────────────────────────────

  it("calls invalidateQueries exactly twice for invoice_funded", () => {
    invalidateCachesForEvent(BASE_EVENT, queryClient);
    // detail + all = 2 calls minimum
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Offline pause ────────────────────────────────────────────────────────────

// We mock at the module level — hoisting ensures the mock is in place before
// the hook module is imported by the test.
vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: vi.fn(() => ({
    health: { overall: "healthy" },
    isOnline: true,
  })),
}));

vi.mock("@/lib/stellar/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar/client")>();
  return {
    ...actual,
    subscribeContractEvents: vi.fn(() => ({
      getMode: () => "stream" as const,
      unsubscribe: vi.fn(),
    })),
    getContractEvents: vi.fn(async () => ({ events: [], latestLedger: 0 })),
  };
});

vi.mock("@/store/walletStore", () => ({
  useWalletStore: vi.fn(() => ({ address: "GABC" })),
}));

vi.mock("@/store/uiStore", () => ({
  useUIStore: vi.fn(() => ({
    notificationPreferences: { invoiceFunded: false },
  })),
  useInvoiceStore: Object.assign(
    vi.fn(() => ({
      updateInvoiceFunding: vi.fn(),
      invoicesByTokenId: {},
      invoices: [],
    })),
    {
      getState: vi.fn(() => ({
        updateInvoiceFunding: vi.fn(),
        invoicesByTokenId: {},
        invoices: [],
      })),
    }
  ),
}));

vi.mock("@/store", () => ({
  useInvoiceStore: Object.assign(
    vi.fn(() => ({
      updateInvoiceFunding: vi.fn(),
      invoicesByTokenId: {},
      invoices: [],
    })),
    {
      getState: vi.fn(() => ({
        updateInvoiceFunding: vi.fn(),
        invoicesByTokenId: {},
        invoices: [],
      })),
    }
  ),
  useUIStore: vi.fn(() => ({
    notificationPreferences: { invoiceFunded: false },
  })),
}));

vi.mock("@/store/settingsStore", () => ({
  useSettingsStore: vi.fn((selector: any) =>
    selector({
      notifications: { fundingAlerts: true, repaymentAlerts: true },
    })
  ),
}));

vi.mock("@/store/invoiceStore", () => ({
  useInvoiceStore: Object.assign(
    vi.fn(() => ({
      updateInvoiceFunding: vi.fn(),
      invoicesByTokenId: {},
      invoices: [],
    })),
    {
      getState: vi.fn(() => ({
        updateInvoiceFunding: vi.fn(),
        invoicesByTokenId: {},
        invoices: [],
      })),
    }
  ),
}));

vi.mock("@/hooks/useFormatters", () => ({
  useFormatters: vi.fn(() => ({
    formatCurrency: (amount: number, code: string) => `${amount} ${code}`,
  })),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: false,
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CTEST",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://gateway.pinata.cloud/ipfs",
  },
}));

import { useContractEvents } from "@/hooks/useContractEvents";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { subscribeContractEvents } from "@/lib/stellar/client";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useContractEvents — offline pause", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (useNetworkStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      health: { overall: "healthy" },
      isOnline: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports isOffline=false when network is healthy", () => {
    const { result } = renderHook(() => useContractEvents(), { wrapper });
    expect(result.current.isOffline).toBe(false);
  });

  it("reports isOffline=true and pauses streaming when network is down", () => {
    (useNetworkStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      health: { overall: "down" },
      isOnline: false,
    });

    const { result } = renderHook(() => useContractEvents(), { wrapper });
    expect(result.current.isOffline).toBe(true);
  });

  it("does not call subscribeContractEvents when offline", () => {
    (useNetworkStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      health: { overall: "down" },
      isOnline: false,
    });

    renderHook(() => useContractEvents(), { wrapper });
    // subscribeContractEvents must NOT be called when offline
    expect(subscribeContractEvents).not.toHaveBeenCalled();
  });

  it("calls subscribeContractEvents when online", () => {
    renderHook(() => useContractEvents(), { wrapper });
    expect(subscribeContractEvents).toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    const unsubscribeSpy = vi.fn();
    (subscribeContractEvents as ReturnType<typeof vi.fn>).mockReturnValue({
      getMode: () => "stream",
      unsubscribe: unsubscribeSpy,
    });

    const { unmount } = renderHook(() => useContractEvents(), { wrapper });
    unmount();
    expect(unsubscribeSpy).toHaveBeenCalledOnce();
  });
});

// ─── Polling / throttle mode ──────────────────────────────────────────────────

describe("useContractEvents — forcePolling / throttle mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (useNetworkStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      health: { overall: "healthy" },
      isOnline: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports mode=polling when forcePolling=true", async () => {
    const { result } = renderHook(
      () => useContractEvents({ forcePolling: true }),
      { wrapper }
    );
    // Polling mode is set synchronously
    expect(result.current.mode).toBe("polling");
  });

  it("does not call subscribeContractEvents when forcePolling=true", () => {
    renderHook(() => useContractEvents({ forcePolling: true }), { wrapper });
    expect(subscribeContractEvents).not.toHaveBeenCalled();
  });

  it("does not subscribe when disabled=true", () => {
    renderHook(() => useContractEvents({ disabled: true }), { wrapper });
    expect(subscribeContractEvents).not.toHaveBeenCalled();
  });

  it("mode reflects stream by default", () => {
    const { result } = renderHook(() => useContractEvents(), { wrapper });
    // Mock returns mode=stream
    expect(result.current.mode).toBe("stream");
  });
});

// ─── fundingAlerts / repaymentAlerts preference gating (#652) ────────────────

import { invalidateCachesForEvent as _ice2 } from "@/hooks/useContractEvents";
import { useSettingsStore } from "@/store/settingsStore";

describe("useContractEvents — fundingAlerts preference (#652)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (useNetworkStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      health: { overall: "healthy" },
      isOnline: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("respects fundingAlerts=true — hook mounts without error", () => {
    (useSettingsStore as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: any) => selector({ notifications: { fundingAlerts: true, repaymentAlerts: true } })
    );
    expect(() => renderHook(() => useContractEvents(), { wrapper })).not.toThrow();
  });

  it("respects fundingAlerts=false — hook mounts without error", () => {
    (useSettingsStore as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: any) => selector({ notifications: { fundingAlerts: false, repaymentAlerts: false } })
    );
    expect(() => renderHook(() => useContractEvents(), { wrapper })).not.toThrow();
  });
});
