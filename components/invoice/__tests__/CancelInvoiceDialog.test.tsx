import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { CancelInvoiceDialog } from "../CancelInvoiceDialog";
import type { Invoice } from "@/types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, any>) => {
    if (key === "partiallyFundedDesc") return `Funded ${params?.amount}`;
    return key;
  },
}));

vi.mock("@/hooks/useFormatters", () => ({
  useFormatters: () => ({
    formatCurrency: (val: number, curr?: string) => `$${val} ${curr || "USDC"}`,
    formatDate: (d: string) => d,
  }),
}));

const mockInvoice: Invoice = {
  id: "inv-cancel-test",
  tokenId: "100",
  contractAddress: "G123",
  ipfsCid: "QmTest",
  metadata: {
    invoiceNumber: "INV-100",
    issuerName: "Issuer Inc",
    issuerAddress: "G123",
    debtorName: "Debtor Ltd",
    debtorAddress: "G456",
    amount: 10000,
    currency: "USDC",
    issueDate: "2025-01-01",
    dueDate: "2025-03-01",
    description: "Cancel test invoice",
    jurisdiction: "US",
    category: "technology",
    documentHash: "QmDoc",
    documentUrl: "https://ipfs.io/ipfs/QmDoc",
  },
  terms: {
    discountRate: 0.05,
    apr: 12,
    financingAmount: 9500,
    minInvestment: 500,
    maxInvestment: 9500,
    tenor: 60,
    repaymentDate: "2025-03-01",
  },
  funding: {
    totalRaised: 0,
    targetAmount: 9500,
    fundingProgress: 0,
    investorCount: 0,
    remainingCapacity: 9500,
  },
  riskTier: "A",
  riskScore: 85,
  debtorPrivacy: "full",
  status: "listed",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  ownerAddress: "G123",
};

describe("CancelInvoiceDialog", () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getTestElement(testId: string) {
    return document.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
  }

  it("renders invoice summary and disabled confirm button when no reason selected", () => {
    render(<CancelInvoiceDialog invoice={mockInvoice} open onConfirm={onConfirm} onCancel={onCancel} />);

    expect(getTestElement("cancel-invoice-confirm")).toBeDisabled();
    expect(getTestElement("cancel-reason-select")).toBeInTheDocument();
  });

  it("waits for the undo window before confirming cancellation", async () => {
    render(<CancelInvoiceDialog invoice={mockInvoice} open onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.change(getTestElement("cancel-reason-select"), {
      target: { value: "duplicate_invoice" },
    });
    fireEvent.change(getTestElement("cancel-notes-input"), {
      target: { value: "Accidental duplicate" },
    });
    fireEvent.click(getTestElement("cancel-invoice-confirm"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(getTestElement("cancel-undo-window")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onConfirm).toHaveBeenCalledWith("duplicate_invoice", "Accidental duplicate");
  });

  it("undoes cancellation before the countdown completes without invoking onConfirm", async () => {
    render(<CancelInvoiceDialog invoice={mockInvoice} open onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.change(getTestElement("cancel-reason-select"), {
      target: { value: "duplicate_invoice" },
    });
    fireEvent.click(getTestElement("cancel-invoice-confirm"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    fireEvent.click(getTestElement("cancel-undo-button"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(getTestElement("cancel-reason-select")).toBeInTheDocument();
  });
});
