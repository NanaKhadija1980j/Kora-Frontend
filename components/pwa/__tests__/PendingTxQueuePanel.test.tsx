/// <reference types="@testing-library/jest-dom" />
/**
 * PendingTxQueuePanel — component tests
 *
 * Covers:
 *  1.  Loading state — skeleton shown with aria-busy="true"
 *  2.  Empty state — empty-state placeholder rendered
 *  3.  List state — single draft renders correct content
 *  4.  Multiple drafts — all items present, retry-all shown only when >1 retryable
 *  5.  Retry button visibility — online vs. offline
 *  6.  Remove button — calls removeQueuedXdrDraft; disabled while retrying
 *  7.  Retry action — success path (mock_ XDR fast-path)
 *  8.  Remove action — removes draft from the list
 *  9.  onCountChange callback
 * 10.  Draft metadata (invoiceId, type, attempts)
 * 11.  Error status display after a failed retry
 * 12.  Success status display and hidden action buttons
 * 13.  className prop forwarding
 * 14.  Retry all button
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PendingTxQueuePanel } from "@/components/pwa/PendingTxQueuePanel";
import type { QueuedXdrDraft } from "@/lib/xdrDraftQueue";

// ─── Module mocks ─────────────────────────────────────────────────────────────

// next-intl — returns human-readable strings for each key used by the component
vi.mock("next-intl", () => ({
  useTranslations: (_namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: values?.count ? `${values.count} pending transaction(s)` : "pending transactions",
      emptyState: "No pending transactions",
      retryAll: "Retry all",
      retryAriaLabel: "Retry this transaction",
      removeAriaLabel: "Discard this transaction",
      offlineAriaLabel: "Waiting for connection",
      listAriaLabel: "Pending signed transactions",
      waitingOnline: "Waiting…",
      retrySuccess: "Transaction submitted successfully",
      retryFailed: "Submission failed",
      removed: "Draft removed from queue",
      txType: values?.type ? String(values.type) : "txType",
      unknownTx: "Signed transaction",
      invoiceLabel: values?.id ? `Invoice #${values.id}` : "invoiceLabel",
      queuedAt: values?.time ? `Queued ${values.time}` : "queuedAt",
      attempts: values?.count ? `${values.count} attempt(s)` : "attempts",
      statusRetrying: "Retrying",
      statusSuccess: "Submitted",
      statusError: "Failed",
      statusPending: "Queued",
      badgeAriaLabel: "pending transaction(s)",
    };
    return map[key] ?? key;
  },
}));

// lib/xdrDraftQueue — all functions mocked; resolved values controlled per-test
vi.mock("@/lib/xdrDraftQueue", () => ({
  listQueuedXdrDrafts: vi.fn(),
  removeQueuedXdrDraft: vi.fn(),
}));

// lib/stellar/client — submitTransaction mocked
vi.mock("@/lib/stellar/client", () => ({
  submitTransaction: vi.fn(),
}));

// hooks/useNetworkStatus — default online; tests can override
vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: vi.fn(),
}));

// lib/env — minimal surface to satisfy PendingTxQueuePanel imports
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_INVOICE_CONTRACT_ID:
      "CTEST000000000000000000000000000000000000000000000000000",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID:
      "CTEST000000000000000000000000000000000000000000000000001",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID:
      "CTEST000000000000000000000000000000000000000000000000002",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

// @stellar/stellar-sdk — no full SDK init in jsdom
vi.mock("@stellar/stellar-sdk", () => ({
  TransactionBuilder: {
    fromXDR: vi.fn(() => ({ toXDR: () => "mock-xdr" })),
  },
}));

// sonner — include toast.info which the component calls on remove
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn(),
  },
}));

// date-fns — stable output so assertions don't drift
vi.mock("date-fns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("date-fns")>();
  return {
    ...actual,
    formatDistanceToNow: vi.fn(() => "2 minutes ago"),
  };
});

// ─── Import mocked modules ────────────────────────────────────────────────────

import { listQueuedXdrDrafts, removeQueuedXdrDraft } from "@/lib/xdrDraftQueue";
import { submitTransaction } from "@/lib/stellar/client";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const mockListQueuedXdrDrafts = vi.mocked(listQueuedXdrDrafts);
const mockRemoveQueuedXdrDraft = vi.mocked(removeQueuedXdrDraft);
const mockSubmitTransaction = vi.mocked(submitTransaction);
const mockUseNetworkStatus = vi.mocked(useNetworkStatus);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function onlineStatus() {
  return {
    isOnline: true,
    wasOffline: false,
    health: {
      overall: "operational" as const,
      soroban: { status: "operational" as const, responseTime: 0, lastChecked: new Date() },
      horizon: { status: "operational" as const, responseTime: 0, lastChecked: new Date() },
      network: "testnet" as const,
    },
    refresh: vi.fn(),
  };
}

function offlineStatus() {
  return {
    isOnline: false,
    wasOffline: true,
    health: {
      overall: "down" as const,
      soroban: { status: "down" as const, responseTime: 0, lastChecked: new Date() },
      horizon: { status: "down" as const, responseTime: 0, lastChecked: new Date() },
      network: "testnet" as const,
    },
    refresh: vi.fn(),
  };
}

/**
 * Build a draft whose signedXdr starts with "mock_".
 * The component's submitDraft detects this prefix and resolves immediately
 * (after a real 800 ms setTimeout). Using the real-timer variant below avoids
 * race conditions with fake timers + userEvent.
 *
 * For tests that need instant resolution we override submitDraft's inner
 * promise by patching the global `setTimeout` on the test level, OR we use the
 * approach of making the signedXdr NOT start with "mock_" and controlling
 * submitTransaction directly.
 */
function makeDraft(id: string, overrides: Partial<QueuedXdrDraft> = {}): QueuedXdrDraft {
  return {
    id,
    // "mock_" prefix → submitDraft fast-path (no StellarSdk, but 800 ms delay)
    signedXdr: `mock_xdr_${id}`,
    meta: { type: "fundInvoice" },
    queuedAt: Date.now() - 120_000,
    attempts: 0,
    ...overrides,
  };
}

/**
 * Build a draft that goes through the real submitTransaction path.
 * This lets us control success / failure without timing issues.
 */
function makeRealDraft(id: string, overrides: Partial<QueuedXdrDraft> = {}): QueuedXdrDraft {
  return {
    id,
    // Any XDR that doesn't start with "mock_" uses the StellarSdk path
    signedXdr: `AAAAAQ${id}==`,
    meta: { type: "fundInvoice" },
    queuedAt: Date.now() - 120_000,
    attempts: 0,
    ...overrides,
  };
}

// ─── beforeEach defaults ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseNetworkStatus.mockReturnValue(onlineStatus());
  mockListQueuedXdrDrafts.mockResolvedValue([]);
  mockRemoveQueuedXdrDraft.mockResolvedValue(undefined);
  mockSubmitTransaction.mockResolvedValue({ status: "SUCCESS" } as any);
});

// ─── 1. Loading state ─────────────────────────────────────────────────────────

describe("loading state", () => {
  it("shows skeleton with aria-busy='true' before drafts are fetched", () => {
    // Keep the promise pending so loading state stays visible
    mockListQueuedXdrDrafts.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PendingTxQueuePanel />);
    expect(container.querySelector("[aria-busy='true']")).toBeInTheDocument();
  });

  it("does not show the empty or list placeholder while loading", () => {
    mockListQueuedXdrDrafts.mockReturnValue(new Promise(() => {}));
    render(<PendingTxQueuePanel />);
    expect(screen.queryByTestId("pending-queue-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pending-queue-panel")).not.toBeInTheDocument();
  });
});

// ─── 2. Empty state ───────────────────────────────────────────────────────────

describe("empty state", () => {
  it("renders the empty placeholder after load with zero drafts", async () => {
    render(<PendingTxQueuePanel />);
    await waitFor(() => {
      expect(screen.getByTestId("pending-queue-empty")).toBeInTheDocument();
    });
  });

  it("shows the empty-state copy", async () => {
    render(<PendingTxQueuePanel />);
    await waitFor(() => {
      expect(screen.getByText("No pending transactions")).toBeInTheDocument();
    });
  });

  it("does not show the list panel", async () => {
    render(<PendingTxQueuePanel />);
    await waitFor(() => {
      expect(screen.queryByTestId("pending-queue-panel")).not.toBeInTheDocument();
    });
  });

  it("calls onCountChange with 0", async () => {
    const onCountChange = vi.fn();
    render(<PendingTxQueuePanel onCountChange={onCountChange} />);
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(0));
  });
});

// ─── 3. List state — single draft ─────────────────────────────────────────────

describe("list state (single draft)", () => {
  beforeEach(() => {
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("alpha")]);
  });

  it("renders the list panel testid", async () => {
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getByTestId("pending-queue-panel")).toBeInTheDocument(),
    );
  });

  it("renders one draft item row", async () => {
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getByTestId("queue-draft-item")).toBeInTheDocument(),
    );
  });

  it("shows the transaction type label", async () => {
    render(<PendingTxQueuePanel />);
    await waitFor(() => expect(screen.getByText("fundInvoice")).toBeInTheDocument());
  });

  it("shows the queued-at timestamp", async () => {
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getByText(/Queued 2 minutes ago/i)).toBeInTheDocument(),
    );
  });

  it("accessible list has the correct aria-label", async () => {
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(
        screen.getByRole("list", { name: "Pending signed transactions" }),
      ).toBeInTheDocument(),
    );
  });

  it("calls onCountChange with 1", async () => {
    const onCountChange = vi.fn();
    render(<PendingTxQueuePanel onCountChange={onCountChange} />);
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(1));
  });

  it("applies a custom className to the outer container", async () => {
    const { container } = render(
      <PendingTxQueuePanel className="my-custom-class" />,
    );
    await waitFor(() =>
      expect(container.querySelector(".my-custom-class")).toBeInTheDocument(),
    );
  });
});

// ─── 4. Multiple drafts + retry-all visibility ────────────────────────────────

describe("list state (multiple drafts)", () => {
  it("renders all three item rows", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([
      makeDraft("d1"),
      makeDraft("d2"),
      makeDraft("d3"),
    ]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getAllByTestId("queue-draft-item")).toHaveLength(3),
    );
  });

  it("shows retry-all when online and >1 retryable draft", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("d1"), makeDraft("d2")]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getByTestId("retry-all-button")).toBeInTheDocument(),
    );
  });

  it("retry-all is absent when offline", async () => {
    mockUseNetworkStatus.mockReturnValue(offlineStatus());
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("d1"), makeDraft("d2")]);
    render(<PendingTxQueuePanel />);
    await waitFor(() => screen.getByTestId("pending-queue-panel"));
    expect(screen.queryByTestId("retry-all-button")).not.toBeInTheDocument();
  });

  it("retry-all is absent when only one retryable draft exists", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("solo")]);
    render(<PendingTxQueuePanel />);
    await waitFor(() => screen.getByTestId("pending-queue-panel"));
    expect(screen.queryByTestId("retry-all-button")).not.toBeInTheDocument();
  });
});

// ─── 5. Retry button visibility ───────────────────────────────────────────────

describe("retry button visibility", () => {
  it("shows retry button for idle draft when online", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("r1")]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getByTestId("retry-draft-button")).toBeInTheDocument(),
    );
  });

  it("retry button has accessible aria-label", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("r1")]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Retry this transaction" }),
      ).toBeInTheDocument(),
    );
  });

  it("does not show retry button when offline", async () => {
    mockUseNetworkStatus.mockReturnValue(offlineStatus());
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("r2")]);
    render(<PendingTxQueuePanel />);
    await waitFor(() => screen.getByTestId("pending-queue-panel"));
    expect(screen.queryByTestId("retry-draft-button")).not.toBeInTheDocument();
  });

  it("shows 'Waiting…' label when offline and draft is idle", async () => {
    mockUseNetworkStatus.mockReturnValue(offlineStatus());
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("r3")]);
    render(<PendingTxQueuePanel />);
    await waitFor(() => expect(screen.getByText("Waiting…")).toBeInTheDocument());
  });
});

// ─── 6. Remove button ─────────────────────────────────────────────────────────

describe("remove (discard) button", () => {
  it("renders a remove button for each idle draft", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("rm1"), makeDraft("rm2")]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getAllByTestId("remove-draft-button")).toHaveLength(2),
    );
  });

  it("remove button has accessible aria-label", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("rm3")]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Discard this transaction" }),
      ).toBeInTheDocument(),
    );
  });

  it("clicking remove calls removeQueuedXdrDraft with the draft id", async () => {
    const user = userEvent.setup();
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("rm4")]);
    render(<PendingTxQueuePanel />);

    await waitFor(() =>
      expect(screen.getByTestId("remove-draft-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("remove-draft-button"));

    await waitFor(() =>
      expect(mockRemoveQueuedXdrDraft).toHaveBeenCalledWith("rm4"),
    );
  });

  it("removes the draft from the list after discard", async () => {
    const user = userEvent.setup();
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("rm5")]);
    render(<PendingTxQueuePanel />);

    await waitFor(() =>
      expect(screen.getByTestId("queue-draft-item")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("remove-draft-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("queue-draft-item")).not.toBeInTheDocument(),
    );
  });

  it("calls onCountChange with 0 after removing the only draft", async () => {
    const user = userEvent.setup();
    const onCountChange = vi.fn();
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("rm6")]);
    render(<PendingTxQueuePanel onCountChange={onCountChange} />);

    await waitFor(() =>
      expect(screen.getByTestId("remove-draft-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("remove-draft-button"));

    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(0));
  });

  it("remove button is disabled while a draft is retrying", async () => {
    // Use a real-XDR draft with a never-resolving submitTransaction so
    // the draft stays in 'retrying' state indefinitely.
    const user = userEvent.setup();
    mockSubmitTransaction.mockReturnValue(new Promise(() => {}));
    mockListQueuedXdrDrafts.mockResolvedValue([makeRealDraft("dis1")]);

    render(<PendingTxQueuePanel />);

    await waitFor(() =>
      expect(screen.getByTestId("retry-draft-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("retry-draft-button"));

    await waitFor(() =>
      expect(screen.getByTestId("remove-draft-button")).toBeDisabled(),
    );
  });
});

// ─── 7. Retry action — success path ──────────────────────────────────────────

describe("retry action — success path", () => {
  it("draft disappears from list after successful retry (real-XDR path)", async () => {
    // Use real-XDR draft: submitTransaction resolves immediately.
    // The component then calls removeQueuedXdrDraft and schedules a 1200 ms
    // setTimeout before removing from state.  We use fake timers to skip that.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    mockSubmitTransaction.mockResolvedValue({ status: "SUCCESS" } as any);
    mockListQueuedXdrDrafts.mockResolvedValue([makeRealDraft("ret1")]);

    render(<PendingTxQueuePanel />);

    // Let the initial load (listQueuedXdrDrafts) resolve
    await act(async () => { /* flush microtasks */ });
    await waitFor(() =>
      expect(screen.getByTestId("retry-draft-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("retry-draft-button"));

    // Advance past the 1200 ms post-success removal delay
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() =>
      expect(screen.queryByTestId("queue-draft-item")).not.toBeInTheDocument(),
    );

    vi.useRealTimers();
  }, 10_000);

  it("calls removeQueuedXdrDraft after a successful retry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    mockSubmitTransaction.mockResolvedValue({ status: "SUCCESS" } as any);
    mockListQueuedXdrDrafts.mockResolvedValue([makeRealDraft("ret2")]);

    render(<PendingTxQueuePanel />);

    await act(async () => { /* flush microtasks */ });
    await waitFor(() =>
      expect(screen.getByTestId("retry-draft-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("retry-draft-button"));

    await waitFor(() =>
      expect(mockRemoveQueuedXdrDraft).toHaveBeenCalledWith("ret2"),
    );

    vi.useRealTimers();
  }, 10_000);
});

// ─── 8. Draft metadata display ────────────────────────────────────────────────

describe("draft metadata", () => {
  it("shows invoice label when meta.invoiceId is set", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([
      makeDraft("meta1", { meta: { type: "fundInvoice", invoiceId: "INV-999" } }),
    ]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getByText("Invoice #INV-999")).toBeInTheDocument(),
    );
  });

  it("does not show invoice label when meta.invoiceId is absent", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([
      makeDraft("meta2", { meta: { type: "fundInvoice" } }),
    ]);
    render(<PendingTxQueuePanel />);
    await waitFor(() => screen.getByTestId("queue-draft-item"));
    expect(screen.queryByText(/Invoice #/i)).not.toBeInTheDocument();
  });

  it("shows 'Signed transaction' for drafts with non-string meta.type", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([
      makeDraft("meta3", { meta: {} }),
    ]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getByText("Signed transaction")).toBeInTheDocument(),
    );
  });

  it("shows attempt count when attempts > 0", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([
      makeDraft("meta4", { attempts: 3 }),
    ]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getByText(/3 attempt/i)).toBeInTheDocument(),
    );
  });

  it("does not show attempts span when attempts === 0", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([
      makeDraft("meta5", { attempts: 0 }),
    ]);
    render(<PendingTxQueuePanel />);
    await waitFor(() => screen.getByTestId("queue-draft-item"));
    expect(screen.queryByText(/0 attempt/i)).not.toBeInTheDocument();
  });
});

// ─── 9. Error status display ──────────────────────────────────────────────────

describe("error status", () => {
  async function triggerError(id: string, errorMessage: string) {
    const user = userEvent.setup();
    mockSubmitTransaction.mockRejectedValue(new Error(errorMessage));
    mockListQueuedXdrDrafts.mockResolvedValue([makeRealDraft(id)]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getByTestId("retry-draft-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("retry-draft-button"));
    return { user };
  }

  it("shows the Failed icon aria-label after a failed retry", async () => {
    await triggerError("err1", "Network error");
    await waitFor(() =>
      expect(screen.getByLabelText("Failed")).toBeInTheDocument(),
    );
  });

  it("shows inline error message text after a failed retry", async () => {
    await triggerError("err2", "RPC timeout");
    await waitFor(() =>
      expect(screen.getByText("RPC timeout")).toBeInTheDocument(),
    );
  });

  it("retry button is shown again after an error (online)", async () => {
    await triggerError("err3", "fail");
    // Draft is now in error state which is retryable — button should reappear
    await waitFor(() =>
      expect(screen.getByTestId("retry-draft-button")).toBeInTheDocument(),
    );
  });
});

// ─── 10. Success status display ───────────────────────────────────────────────

describe("success status transition", () => {
  it("shows the 'Submitted' icon immediately after a successful retry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    mockSubmitTransaction.mockResolvedValue({ status: "SUCCESS" } as any);
    mockListQueuedXdrDrafts.mockResolvedValue([makeRealDraft("suc1")]);
    render(<PendingTxQueuePanel />);

    await act(async () => { /* flush microtasks */ });
    await waitFor(() =>
      expect(screen.getByTestId("retry-draft-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("retry-draft-button"));

    // submitTransaction resolves synchronously (Promise.resolve) so the
    // success state is set before any timer fires.
    await waitFor(() =>
      expect(screen.getByLabelText("Submitted")).toBeInTheDocument(),
    );

    vi.useRealTimers();
  }, 10_000);

  it("hides action buttons once the draft is in success state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    mockSubmitTransaction.mockResolvedValue({ status: "SUCCESS" } as any);
    mockListQueuedXdrDrafts.mockResolvedValue([makeRealDraft("suc2")]);
    render(<PendingTxQueuePanel />);

    await act(async () => { /* flush microtasks */ });
    await waitFor(() =>
      expect(screen.getByTestId("retry-draft-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("retry-draft-button"));

    await waitFor(() => {
      expect(screen.queryByTestId("retry-draft-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("remove-draft-button")).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  }, 10_000);
});

// ─── 11. Retry all button ─────────────────────────────────────────────────────

describe("retry all button", () => {
  it("clicking retry all triggers retry for each idle draft", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    mockSubmitTransaction.mockResolvedValue({ status: "SUCCESS" } as any);
    mockListQueuedXdrDrafts.mockResolvedValue([
      makeRealDraft("ra1"),
      makeRealDraft("ra2"),
    ]);
    render(<PendingTxQueuePanel />);

    await act(async () => { /* flush microtasks */ });
    await waitFor(() =>
      expect(screen.getByTestId("retry-all-button")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("retry-all-button"));

    // Both retries resolve → removeQueuedXdrDraft called for each
    await waitFor(() => {
      expect(mockRemoveQueuedXdrDraft).toHaveBeenCalledWith("ra1");
      expect(mockRemoveQueuedXdrDraft).toHaveBeenCalledWith("ra2");
    });

    vi.useRealTimers();
  }, 10_000);

  it("retry all button shows 'Retry all' label", async () => {
    mockListQueuedXdrDrafts.mockResolvedValue([makeDraft("ra3"), makeDraft("ra4")]);
    render(<PendingTxQueuePanel />);
    await waitFor(() =>
      expect(screen.getByTestId("retry-all-button")).toHaveTextContent("Retry all"),
    );
  });
});
