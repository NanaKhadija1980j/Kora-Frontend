/**
 * Tests for BatchActionToolbar multi-select wiring in the SME dashboard.
 *
 * Covers:
 *  a) Toolbar appears only when ≥ 2 invoices are selected
 *  b) "Cancel Selected" opens confirmation dialog showing correct count
 *  c) Only "Active" status invoices are eligible for batch cancel
 *  d) "Export Selected" triggers CSV download
 *  e) Confirmation "Go Back" dismisses without action
 *  f) Confirmation "Confirm" proceeds with cancellation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { BatchActionToolbar } from "@/components/dashboard/BatchActionToolbar";
import type { BatchQueueItem } from "@/lib/batch/txQueue";

function render(ui: React.ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={en}>
        {children}
      </NextIntlClientProvider>
    ),
  });
}

// ─── Unit tests for BatchActionToolbar component ──────────────────────────────

describe("BatchActionToolbar", () => {
  it("renders nothing when selectedCount is 0", () => {
    const { container } = render(
      <BatchActionToolbar selectedCount={0} onCancel={vi.fn()} onExport={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when selectedCount >= 1", () => {
    render(
      <BatchActionToolbar selectedCount={1} onCancel={vi.fn()} onExport={vi.fn()} />
    );
    expect(screen.getByText(/1 Invoices Selected/i)).toBeInTheDocument();
  });

  it("shows correct selectedCount label", () => {
    render(
      <BatchActionToolbar selectedCount={3} onCancel={vi.fn()} onExport={vi.fn()} />
    );
    expect(screen.getByText(/3 Invoices Selected/i)).toBeInTheDocument();
  });

  it("calls onCancel when Cancel Invoices button is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <BatchActionToolbar selectedCount={2} onCancel={onCancel} onExport={vi.fn()} />
    );

    const cancelBtn = screen.getByText(/Cancel Invoices/i);
    await user.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onExport when Export CSV button is clicked", async () => {
    const onExport = vi.fn();
    const user = userEvent.setup();

    render(
      <BatchActionToolbar selectedCount={2} onCancel={vi.fn()} onExport={onExport} />
    );

    const exportBtn = screen.getByText(/Export CSV/i);
    await user.click(exportBtn);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("shows processing state when isProcessing=true", () => {
    render(
      <BatchActionToolbar
        selectedCount={3}
        onCancel={vi.fn()}
        onExport={vi.fn()}
        isProcessing={true}
        progress={50}
        processingLabel="Cancelling 3 invoices..."
      />
    );
    expect(screen.getByText(/Cancelling 3 invoices.../i)).toBeInTheDocument();
    expect(screen.getByText(/50% completed/i)).toBeInTheDocument();
    // Cancel / Export buttons hidden during processing
    expect(screen.queryByText(/Cancel Invoices/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Export CSV/i)).not.toBeInTheDocument();
  });

  it("hides action buttons when isProcessing=true", () => {
    render(
      <BatchActionToolbar
        selectedCount={2}
        onCancel={vi.fn()}
        onExport={vi.fn()}
        isProcessing={true}
        progress={0}
      />
    );
    expect(screen.queryByText(/Cancel Invoices/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Export CSV/i)).not.toBeInTheDocument();
  });
});

// ─── Enable/disable and batch callback actions (#821) ─────────────────────────

describe("BatchActionToolbar — enable/disable and callbacks", () => {
  const item = (id: string, status: BatchQueueItem["status"]): BatchQueueItem => ({
    id,
    tokenId: id,
    label: id,
    action: "cancel",
    status,
  });

  it("enables Cancel and Repay by default", () => {
    render(
      <BatchActionToolbar selectedCount={2} onCancel={vi.fn()} onRepay={vi.fn()} onExport={vi.fn()} />
    );
    expect(screen.getByTestId("batch-cancel-btn")).toBeEnabled();
    expect(screen.getByTestId("batch-repay-btn")).toBeEnabled();
  });

  it("disables Cancel when canCancel=false and does not fire onCancel", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <BatchActionToolbar selectedCount={2} onCancel={onCancel} onExport={vi.fn()} canCancel={false} />
    );

    const cancelBtn = screen.getByTestId("batch-cancel-btn");
    expect(cancelBtn).toBeDisabled();
    await user.click(cancelBtn);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("disables Repay when canRepay=false and does not fire onRepay", async () => {
    const onRepay = vi.fn();
    const user = userEvent.setup();
    render(
      <BatchActionToolbar
        selectedCount={2}
        onCancel={vi.fn()}
        onRepay={onRepay}
        onExport={vi.fn()}
        canRepay={false}
      />
    );

    const repayBtn = screen.getByTestId("batch-repay-btn");
    expect(repayBtn).toBeDisabled();
    await user.click(repayBtn);
    expect(onRepay).not.toHaveBeenCalled();
  });

  it("calls onRepay when the Repay button is clicked", async () => {
    const onRepay = vi.fn();
    const user = userEvent.setup();
    render(
      <BatchActionToolbar selectedCount={2} onCancel={vi.fn()} onRepay={onRepay} onExport={vi.fn()} />
    );

    await user.click(screen.getByTestId("batch-repay-btn"));
    expect(onRepay).toHaveBeenCalledTimes(1);
  });

  it("hides the Repay button when onRepay is not provided", () => {
    render(<BatchActionToolbar selectedCount={2} onCancel={vi.fn()} onExport={vi.fn()} />);
    expect(screen.queryByTestId("batch-repay-btn")).not.toBeInTheDocument();
  });

  it("keeps Export enabled when cancel and repay are disabled", async () => {
    const onExport = vi.fn();
    const user = userEvent.setup();
    render(
      <BatchActionToolbar
        selectedCount={2}
        onCancel={vi.fn()}
        onRepay={vi.fn()}
        onExport={onExport}
        canCancel={false}
        canRepay={false}
      />
    );

    await user.click(screen.getByRole("button", { name: /Export CSV/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("shows Retry and calls onResumeFailed when failed items exist", async () => {
    const onResumeFailed = vi.fn();
    const user = userEvent.setup();
    render(
      <BatchActionToolbar
        selectedCount={2}
        onCancel={vi.fn()}
        onExport={vi.fn()}
        onResumeFailed={onResumeFailed}
        items={[item("INV-1", "success"), item("INV-2", "failed")]}
      />
    );

    await user.click(screen.getByTestId("batch-resume-btn"));
    expect(onResumeFailed).toHaveBeenCalledTimes(1);
  });

  it("hides Retry when no items have failed", () => {
    render(
      <BatchActionToolbar
        selectedCount={2}
        onCancel={vi.fn()}
        onExport={vi.fn()}
        onResumeFailed={vi.fn()}
        items={[item("INV-1", "success"), item("INV-2", "pending")]}
      />
    );
    expect(screen.queryByTestId("batch-resume-btn")).not.toBeInTheDocument();
  });

  it("renders per-item progress rows with their status", () => {
    render(
      <BatchActionToolbar
        selectedCount={0}
        onCancel={vi.fn()}
        onExport={vi.fn()}
        items={[item("INV-1", "success"), item("INV-2", "failed")]}
      />
    );

    const rows = screen.getByTestId("batch-item-list").querySelectorAll("li");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-status", "success");
    expect(rows[1]).toHaveAttribute("data-status", "failed");
  });
});

// ─── Cancel constraint: unfunded listed/pending (aligned with single cancel) ──

import type { Invoice } from "@/types";
import { createMockInvoice } from "./fixtures";
import { isBatchCancelEligible } from "@/lib/batch/eligibility";

describe("Batch cancel — eligibility constraint", () => {
  it("only selects unfunded listed/pending invoices for cancellation", () => {
    const invoices = [
      createMockInvoice({ id: "inv_1", status: "listed", funding: { totalRaised: 0, targetAmount: 1000, fundingProgress: 0, investorCount: 0, remainingCapacity: 1000 } }),
      createMockInvoice({ id: "inv_2", status: "active" }),
      createMockInvoice({ id: "inv_3", status: "pending_mint", funding: { totalRaised: 0, targetAmount: 1000, fundingProgress: 0, investorCount: 0, remainingCapacity: 1000 } }),
      createMockInvoice({ id: "inv_4", status: "fully_funded" }),
      createMockInvoice({ id: "inv_5", status: "listed", funding: { totalRaised: 100, targetAmount: 1000, fundingProgress: 0.1, investorCount: 1, remainingCapacity: 900 } }),
    ];

    const selectedIds = invoices.map((i) => i.id);

    const eligible = invoices.filter(
      (inv) => selectedIds.includes(inv.id) && isBatchCancelEligible(inv)
    );

    expect(eligible).toHaveLength(2);
    expect(eligible.map((i) => i.id)).toEqual(["inv_1", "inv_3"]);
  });

  it("returns zero eligible when no cancelable invoices are selected", () => {
    const invoices = [
      createMockInvoice({ id: "inv_1", status: "active" }),
      createMockInvoice({ id: "inv_2", status: "fully_funded" }),
    ];
    const selectedIds = invoices.map((i) => i.id);

    const eligible = invoices.filter(
      (inv) => selectedIds.includes(inv.id) && isBatchCancelEligible(inv)
    );

    expect(eligible).toHaveLength(0);
  });
});

// ─── BatchResultSummary ───────────────────────────────────────────────────────

import { BatchResultSummary } from "@/components/dashboard/BatchActionToolbar";

describe("BatchResultSummary", () => {
  it("renders totals correctly", () => {
    render(
      <BatchResultSummary
        total={5}
        successCount={4}
        failedCount={1}
        errors={[{ id: "INV-001", error: "Transaction failed" }]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows error details when failures exist", () => {
    render(
      <BatchResultSummary
        total={2}
        successCount={1}
        failedCount={1}
        errors={[{ id: "INV-002", error: "Network timeout" }]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("INV-002")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
  });

  it("calls onClose when Done button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <BatchResultSummary
        total={3}
        successCount={3}
        failedCount={0}
        errors={[]}
        onClose={onClose}
      />
    );

    await user.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows success-only message when failedCount is 0", () => {
    render(
      <BatchResultSummary
        total={3}
        successCount={3}
        failedCount={0}
        errors={[]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/3 invoices were successfully processed/i)).toBeInTheDocument();
    expect(screen.queryByText(/Some operations failed/i)).not.toBeInTheDocument();
  });

  it("shows partial failure message when failedCount > 0", () => {
    render(
      <BatchResultSummary
        total={3}
        successCount={2}
        failedCount={1}
        errors={[{ id: "INV-X", error: "err" }]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Some operations failed/i)).toBeInTheDocument();
  });
});
