/// <reference types="@testing-library/jest-dom" />
/**
 * BatchTxQueuePanel — unit tests (Issue #730)
 *
 * Tests:
 *  1. Renders nothing when snapshot has 0 items
 *  2. Pending state: all items show "Pending" status
 *  3. Processing state: current item shows processing indicator, progress bar present
 *  4. Success state: all items show success, "Batch Complete" heading
 *  5. Failed state: failed items show error, "Retry failed" button appears
 *  6. Dismiss button appears only when queue is done + onDismiss is supplied
 *  7. Collapse/expand toggle hides and shows the item list
 *  8. Live region is present for screen-reader announcements
 *  9. Mixed success/failed: shows partial success counts
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchTxQueuePanel } from "@/components/dashboard/BatchTxQueuePanel";
import type { BatchQueueSnapshot, BatchQueueItem } from "@/lib/batch/txQueue";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CTEST000000000000000000000000000000000000000000000000000",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CTEST000000000000000000000000000000000000000000000000001",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CTEST000000000000000000000000000000000000000000000000002",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

// framer-motion: skip animations in tests
vi.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <div {...props} ref={ref}>{children}</div>
      )),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function item(
  id: string,
  status: BatchQueueItem["status"],
  action: BatchQueueItem["action"] = "cancel",
  overrides: Partial<BatchQueueItem> = {},
): BatchQueueItem {
  return {
    id,
    tokenId: `token-${id}`,
    label: `INV-2026-00${id}`,
    action,
    status,
    ...overrides,
  };
}

function makeSnapshot(
  items: BatchQueueItem[],
  overrides: Partial<BatchQueueSnapshot> = {},
): BatchQueueSnapshot {
  const successCount = items.filter((i) => i.status === "success").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const processed = items.filter(
    (i) => i.status === "success" || i.status === "failed" || i.status === "skipped",
  ).length;
  return {
    items,
    currentIndex: overrides.currentIndex ?? -1,
    isRunning: overrides.isRunning ?? false,
    processed: overrides.processed ?? processed,
    successCount: overrides.successCount ?? successCount,
    failedCount: overrides.failedCount ?? failedCount,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BatchTxQueuePanel", () => {

  // ── 1. Empty snapshot — renders nothing ─────────────────────────────────────

  describe("empty snapshot", () => {
    it("renders nothing when items array is empty", () => {
      const { container } = render(
        <BatchTxQueuePanel snapshot={makeSnapshot([])} />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  // ── 2. Pending state ─────────────────────────────────────────────────────────

  describe("pending state (loaded, not yet started)", () => {
    const pendingSnapshot = makeSnapshot([
      item("1", "pending"),
      item("2", "pending"),
      item("3", "pending"),
    ]);

    it("renders the panel with testid", () => {
      render(<BatchTxQueuePanel snapshot={pendingSnapshot} />);
      expect(screen.getByTestId("batch-tx-queue-panel")).toBeInTheDocument();
    });

    it("shows 'Queued Batch Operations' heading when not started", () => {
      render(<BatchTxQueuePanel snapshot={pendingSnapshot} />);
      expect(screen.getByText(/Queued Batch Operations/i)).toBeInTheDocument();
    });

    it("shows '0 / 3 succeeded' counter", () => {
      render(<BatchTxQueuePanel snapshot={pendingSnapshot} />);
      expect(screen.getByText(/0 \/ 3 succeeded/i)).toBeInTheDocument();
    });

    it("renders all 3 item rows", () => {
      render(<BatchTxQueuePanel snapshot={pendingSnapshot} />);
      expect(screen.getByTestId("batch-item-1")).toBeInTheDocument();
      expect(screen.getByTestId("batch-item-2")).toBeInTheDocument();
      expect(screen.getByTestId("batch-item-3")).toBeInTheDocument();
    });

    it("items have data-status='pending'", () => {
      render(<BatchTxQueuePanel snapshot={pendingSnapshot} />);
      expect(screen.getByTestId("batch-item-1")).toHaveAttribute(
        "data-status",
        "pending",
      );
    });
  });

  // ── 3. Processing state ───────────────────────────────────────────────────────

  describe("processing state (queue is running)", () => {
    const processingSnapshot = makeSnapshot(
      [
        item("1", "success"),
        item("2", "processing"),
        item("3", "pending"),
      ],
      { isRunning: true, currentIndex: 1, processed: 1 },
    );

    it("shows 'Processing Batch…' heading", () => {
      render(<BatchTxQueuePanel snapshot={processingSnapshot} />);
      expect(screen.getByText(/Processing Batch…/i)).toBeInTheDocument();
    });

    it("item 2 has data-status='processing'", () => {
      render(<BatchTxQueuePanel snapshot={processingSnapshot} />);
      expect(screen.getByTestId("batch-item-2")).toHaveAttribute(
        "data-status",
        "processing",
      );
    });

    it("shows the progress bar role", () => {
      render(<BatchTxQueuePanel snapshot={processingSnapshot} />);
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("progress bar reflects processed / total", () => {
      render(<BatchTxQueuePanel snapshot={processingSnapshot} />);
      const bar = screen.getByRole("progressbar");
      // 1/3 ≈ 33%
      expect(bar).toHaveAttribute("aria-valuenow", "33");
    });

    it("does not show retry or dismiss buttons while running", () => {
      const onResumeFailed = vi.fn();
      render(
        <BatchTxQueuePanel
          snapshot={processingSnapshot}
          onResumeFailed={onResumeFailed}
          onDismiss={vi.fn()}
        />,
      );
      expect(screen.queryByTestId("batch-panel-retry-btn")).not.toBeInTheDocument();
      expect(screen.queryByTestId("batch-panel-dismiss-btn")).not.toBeInTheDocument();
    });
  });

  // ── 4. All success state ─────────────────────────────────────────────────────

  describe("all success state", () => {
    const successSnapshot = makeSnapshot([
      item("1", "success", "cancel", { txHash: "hash-aaa-111" }),
      item("2", "success", "repay", { txHash: "hash-bbb-222" }),
    ]);

    it("shows 'Batch Complete' heading", () => {
      render(<BatchTxQueuePanel snapshot={successSnapshot} />);
      expect(screen.getByText(/Batch Complete/i)).toBeInTheDocument();
    });

    it("shows '2 / 2 succeeded' counter", () => {
      render(<BatchTxQueuePanel snapshot={successSnapshot} />);
      expect(screen.getByText(/2 \/ 2 succeeded/i)).toBeInTheDocument();
    });

    it("items have data-status='success'", () => {
      render(<BatchTxQueuePanel snapshot={successSnapshot} />);
      expect(screen.getByTestId("batch-item-1")).toHaveAttribute(
        "data-status",
        "success",
      );
      expect(screen.getByTestId("batch-item-2")).toHaveAttribute(
        "data-status",
        "success",
      );
    });

    it("shows tx hash prefix for successful items", () => {
      render(<BatchTxQueuePanel snapshot={successSnapshot} />);
      // txHash.slice(0, 12)… = "hash-aaa-111"
      expect(screen.getByText(/hash-aaa-111/)).toBeInTheDocument();
    });

    it("does not show retry button when no failures", () => {
      render(
        <BatchTxQueuePanel
          snapshot={successSnapshot}
          onResumeFailed={vi.fn()}
        />,
      );
      expect(screen.queryByTestId("batch-panel-retry-btn")).not.toBeInTheDocument();
    });

    it("shows dismiss button when onDismiss is provided", () => {
      render(
        <BatchTxQueuePanel
          snapshot={successSnapshot}
          onDismiss={vi.fn()}
        />,
      );
      expect(screen.getByTestId("batch-panel-dismiss-btn")).toBeInTheDocument();
    });

    it("calls onDismiss when dismiss is clicked", async () => {
      const onDismiss = vi.fn();
      const user = userEvent.setup();
      render(<BatchTxQueuePanel snapshot={successSnapshot} onDismiss={onDismiss} />);
      await user.click(screen.getByTestId("batch-panel-dismiss-btn"));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  // ── 5. Failed items state ─────────────────────────────────────────────────────

  describe("failed items state", () => {
    const failedSnapshot = makeSnapshot([
      item("1", "success"),
      item("2", "failed", "cancel", { error: "Signing rejected by user" }),
      item("3", "failed", "repay", { error: "Insufficient USDC balance" }),
    ]);

    it("shows 'Batch Done — 2 failed' heading", () => {
      render(<BatchTxQueuePanel snapshot={failedSnapshot} />);
      expect(screen.getByText(/Batch Done — 2 failed/i)).toBeInTheDocument();
    });

    it("shows '1 / 3 succeeded · 2 failed' counter", () => {
      render(<BatchTxQueuePanel snapshot={failedSnapshot} />);
      expect(screen.getByText(/1 \/ 3 succeeded/i)).toBeInTheDocument();
      expect(screen.getByText(/2 failed/i)).toBeInTheDocument();
    });

    it("failed items show error message", () => {
      render(<BatchTxQueuePanel snapshot={failedSnapshot} />);
      expect(screen.getByText(/Signing rejected by user/i)).toBeInTheDocument();
      expect(screen.getByText(/Insufficient USDC balance/i)).toBeInTheDocument();
    });

    it("failed items have data-status='failed'", () => {
      render(<BatchTxQueuePanel snapshot={failedSnapshot} />);
      expect(screen.getByTestId("batch-item-2")).toHaveAttribute(
        "data-status",
        "failed",
      );
    });

    it("shows 'Retry 2 failed' button when onResumeFailed is provided", () => {
      render(
        <BatchTxQueuePanel
          snapshot={failedSnapshot}
          onResumeFailed={vi.fn()}
        />,
      );
      expect(screen.getByTestId("batch-panel-retry-btn")).toBeInTheDocument();
      expect(screen.getByTestId("batch-panel-retry-btn")).toHaveTextContent(/retry 2 failed/i);
    });

    it("calls onResumeFailed when retry button is clicked", async () => {
      const onResumeFailed = vi.fn();
      const user = userEvent.setup();
      render(
        <BatchTxQueuePanel
          snapshot={failedSnapshot}
          onResumeFailed={onResumeFailed}
        />,
      );
      await user.click(screen.getByTestId("batch-panel-retry-btn"));
      expect(onResumeFailed).toHaveBeenCalledTimes(1);
    });

    it("does not show retry button when onResumeFailed is not provided", () => {
      render(<BatchTxQueuePanel snapshot={failedSnapshot} />);
      expect(screen.queryByTestId("batch-panel-retry-btn")).not.toBeInTheDocument();
    });
  });

  // ── 6. Collapse / expand ──────────────────────────────────────────────────────

  describe("collapse / expand toggle", () => {
    const snapshot = makeSnapshot([
      item("1", "pending"),
      item("2", "pending"),
    ]);

    it("item list is visible initially", () => {
      render(<BatchTxQueuePanel snapshot={snapshot} />);
      expect(screen.getByTestId("batch-panel-item-list")).toBeInTheDocument();
    });

    it("clicking collapse hides the item list", async () => {
      const user = userEvent.setup();
      render(<BatchTxQueuePanel snapshot={snapshot} />);
      await user.click(screen.getByTestId("batch-panel-collapse-btn"));
      expect(screen.queryByTestId("batch-panel-item-list")).not.toBeInTheDocument();
    });

    it("clicking collapse twice restores the item list", async () => {
      const user = userEvent.setup();
      render(<BatchTxQueuePanel snapshot={snapshot} />);
      await user.click(screen.getByTestId("batch-panel-collapse-btn"));
      await user.click(screen.getByTestId("batch-panel-collapse-btn"));
      expect(screen.getByTestId("batch-panel-item-list")).toBeInTheDocument();
    });
  });

  // ── 7. Accessible live region ─────────────────────────────────────────────────

  describe("accessible live region", () => {
    it("has a role=status live region", () => {
      render(<BatchTxQueuePanel snapshot={makeSnapshot([item("1", "pending")])} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("live region is aria-live=polite", () => {
      render(<BatchTxQueuePanel snapshot={makeSnapshot([item("1", "pending")])} />);
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    });

    it("live region has testid batch-panel-live-region", () => {
      render(<BatchTxQueuePanel snapshot={makeSnapshot([item("1", "pending")])} />);
      expect(screen.getByTestId("batch-panel-live-region")).toBeInTheDocument();
    });
  });

  // ── 8. Mixed state — one processing, others pending ──────────────────────────

  describe("mixed state with one processing and others pending", () => {
    const mixedSnapshot = makeSnapshot(
      [
        item("1", "success"),
        item("2", "processing"),
        item("3", "pending"),
        item("4", "pending"),
      ],
      { isRunning: true, currentIndex: 1, processed: 1 },
    );

    it("renders all four item rows", () => {
      render(<BatchTxQueuePanel snapshot={mixedSnapshot} />);
      const list = screen.getByTestId("batch-panel-item-list");
      expect(list.querySelectorAll("li")).toHaveLength(4);
    });

    it("each item has the correct data-status", () => {
      render(<BatchTxQueuePanel snapshot={mixedSnapshot} />);
      expect(screen.getByTestId("batch-item-1")).toHaveAttribute("data-status", "success");
      expect(screen.getByTestId("batch-item-2")).toHaveAttribute("data-status", "processing");
      expect(screen.getByTestId("batch-item-3")).toHaveAttribute("data-status", "pending");
      expect(screen.getByTestId("batch-item-4")).toHaveAttribute("data-status", "pending");
    });
  });
});
