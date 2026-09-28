import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  getProviderSigningConfig,
  PROVIDER_SIGNING_CONFIGS,
  useTxAnnouncement,
} from "@/hooks/useTransaction";
import { InProgressOverlay } from "@/components/transactions/InProgressOverlay";
import { useUIStore } from "@/store/uiStore";
import { useWalletStore } from "@/store/walletStore";
import { useTransactionHistoryStore } from "@/store/transactionHistoryStore";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("Hardware-Wallet Friendly Signing Timeouts UX — Issue #579", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUIStore.setState({ txState: { status: "idle" } });
    useTransactionHistoryStore.setState({ transactions: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Provider-specific timeout configurations", () => {
    it("returns 120s timeout and Ledger tips for Ledger provider", () => {
      const config = getProviderSigningConfig("ledger");
      expect(config.timeoutMs).toBe(120_000);
      expect(config.category).toBe("hardware");
      expect(config.providerName).toContain("Ledger");
      expect(config.tips.some((t) => t.includes("Blind Signing"))).toBe(true);
    });

    it("returns 90s timeout and mobile push tips for Lobstr provider", () => {
      const config = getProviderSigningConfig("lobstr");
      expect(config.timeoutMs).toBe(90_000);
      expect(config.category).toBe("mobile");
      expect(config.providerName).toContain("Lobstr");
      expect(config.tips.some((t) => t.includes("push notifications"))).toBe(true);
    });

    it("returns 60s timeout for browser extension providers (Freighter, xBull, Albedo)", () => {
      expect(getProviderSigningConfig("freighter").timeoutMs).toBe(60_000);
      expect(getProviderSigningConfig("xbull").timeoutMs).toBe(60_000);
      expect(getProviderSigningConfig("albedo").timeoutMs).toBe(60_000);
    });

    it("falls back to default config for unknown provider", () => {
      const config = getProviderSigningConfig(null);
      expect(config.timeoutMs).toBe(60_000);
      expect(config.category).toBe("default");
    });
  });

  describe("useTxAnnouncement accessibility live regions", () => {
    it("announces signing status politely with provider name", () => {
      useUIStore.setState({
        txState: {
          status: "signing",
          provider: "Hardware Wallet (Ledger)",
        },
      });

      const { result } = renderHook(() => useTxAnnouncement());
      expect(result.current.polite).toContain("Hardware Wallet (Ledger)");
    });

    it("announces timeout status assertively with actionable guidance", () => {
      useUIStore.setState({
        txState: {
          status: "timeout",
          provider: "Lobstr Mobile Wallet",
        },
      });

      const { result } = renderHook(() => useTxAnnouncement());
      expect(result.current.assertive).toContain("timed out waiting for wallet response");
    });
  });

  describe("InProgressOverlay safe cancellation and timeout recovery", () => {
    it("renders waiting overlay with countdown and provider badge", () => {
      useUIStore.setState({
        txState: {
          status: "signing",
          provider: "Hardware Wallet (Ledger)",
          timeoutMs: 120_000,
          startedAt: Date.now(),
        },
      });

      render(<InProgressOverlay />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Waiting for Signature")).toBeInTheDocument();
      expect(screen.getByText("Hardware Wallet (Ledger)")).toBeInTheDocument();
    });

    it("safe cancel resets txState to idle without leaving zombie history records", () => {
      useUIStore.setState({
        txState: {
          status: "signing",
          provider: "Freighter Wallet",
          startedAt: Date.now(),
        },
      });

      render(<InProgressOverlay />);

      const cancelBtn = screen.getByRole("button", { name: /Cancel Safely/i });
      fireEvent.click(cancelBtn);

      expect(useUIStore.getState().txState.status).toBe("idle");
      expect(useTransactionHistoryStore.getState().transactions.length).toBe(0);
    });

    it("displays recoverable timeout screen when state is timeout", () => {
      useUIStore.setState({
        txState: {
          status: "timeout",
          provider: "Hardware Wallet (Ledger)",
        },
      });

      render(<InProgressOverlay />);

      expect(screen.getByText("Signing Request Timed Out")).toBeInTheDocument();
      expect(screen.getByText(/Extend Time/i)).toBeInTheDocument();
      expect(screen.getByText(/Cancel Safely/i)).toBeInTheDocument();
    });

    it("allows extending timeout from timeout screen", () => {
      useWalletStore.setState({ provider: "ledger" as any });
      useUIStore.setState({
        txState: {
          status: "timeout",
          provider: "Hardware Wallet (Ledger)",
        },
      });

      render(<InProgressOverlay />);

      const extendBtn = screen.getByText(/Extend Time/i);
      fireEvent.click(extendBtn);

      expect(useUIStore.getState().txState.status).toBe("signing");
    });
  });
});

function renderHook<T>(hook: () => T): { result: { current: T } } {
  const result = { current: null as any };
  function Component() {
    result.current = hook();
    return null;
  }
  render(<Component />);
  return { result };
}
