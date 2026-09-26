import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InProgressOverlay } from "../InProgressOverlay";
import { useUIStore } from "@/store/uiStore";

// Mock framer-motion to simplify DOM output
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

// Resolve translations from the English catalog
vi.mock("next-intl", async () => {
  const en = (await import("@/messages/en.json")).default as Record<string, Record<string, string>>;
  return {
    useTranslations: (namespace: string) => (key: string) => en[namespace]?.[key] ?? key,
  };
});

// Mock useTransaction hook and providers
vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: () => ({
    cancel: vi.fn(),
    extendTimeout: vi.fn(),
  }),
  useSecondaryEscrowFlow: () => ({
    escrowState: { step: "idle", attemptHistory: [] },
    retryEscrow: vi.fn(),
    resetEscrow: vi.fn(),
  }),
  getProviderSigningConfig: () => ({
    providerName: "Freighter",
    category: "extension",
    timeoutMs: 60000,
    tips: ["Check browser extension popup"],
  }),
}));

vi.mock("@/store/walletStore", () => ({
  useWalletStore: (selector: any) => selector({ provider: "freighter" }),
}));

vi.mock("@/store/transactionStore", () => ({
  useTransactionStore: () => ({
    escrowState: { attemptHistory: [] },
  }),
}));

describe("InProgressOverlay - Accessibility & Live Regions", () => {
  beforeEach(() => {
    useUIStore.setState({
      txState: { status: "idle" },
    });
  });

  it("does not render when txState is idle", () => {
    render(<InProgressOverlay />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders with role=dialog, aria-modal=true, and live region during signing stage", () => {
    useUIStore.setState({
      txState: {
        status: "signing",
        startedAt: Date.now(),
        timeoutMs: 60000,
      },
    });

    render(<InProgressOverlay />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const liveRegion = screen.getByTestId("tx-overlay-announcement");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute("role", "status");
    expect(liveRegion).toHaveAttribute("aria-live", "assertive");
    expect(liveRegion).toHaveTextContent(/Waiting for transaction signature/i);
  });

  it("announces timeout when txState status is timeout", () => {
    useUIStore.setState({
      txState: {
        status: "timeout",
      },
    });

    render(<InProgressOverlay />);

    const liveRegion = screen.getByTestId("tx-overlay-announcement");
    expect(liveRegion).toHaveTextContent(/signing request timed out/i);
  });

  it("uses localized aria-labels for extra-time and cancel during signing", () => {
    useUIStore.setState({
      txState: {
        status: "signing",
        startedAt: Date.now(),
        timeoutMs: 60000,
      },
    });

    render(<InProgressOverlay />);

    expect(screen.getByRole("button", { name: "Add extra time for slow wallet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel transaction signing safely" })).toBeInTheDocument();
  });

  it("uses a localized aria-label for cancel on timeout", () => {
    useUIStore.setState({ txState: { status: "timeout" } });

    render(<InProgressOverlay />);

    expect(screen.getByRole("button", { name: "Cancel signing safely" })).toBeInTheDocument();
  });
});
