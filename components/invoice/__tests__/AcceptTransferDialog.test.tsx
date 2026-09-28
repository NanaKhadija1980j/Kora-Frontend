import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AcceptTransferDialog } from "../AcceptTransferDialog";
import type { Invoice } from "@/types/invoice";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, any>) => {
    const map: Record<string, string> = {
      title: "Accept Position Transfer",
      description: "Review the position details before accepting this transfer on the secondary market.",
      positionLabel: "Position",
      expectedReturn: "Expected Return",
      positionDetails: "Position Details",
      remainingTenor: "Remaining Tenor",
      fromAddress: "From Address",
      notImplementedTitle: "Not Yet Available",
      notImplementedHint: "Buyer acceptance isn't available on-chain yet — check back once this contract path ships.",
      cancel: "Cancel",
      confirmAccept: "Accept Transfer",
      pending: "Processing…",
    };
    return map[key] ?? key;
  },
}));

const mockInvoice = {
  metadata: { invoiceNumber: "INV-2026-001", currency: "USDC" },
  riskTier: "AA",
} as unknown as Invoice;

const mockItem = {
  positionId: "pos_101",
  invoice: mockInvoice,
  expectedReturn: 5000,
  sellerAddress: "GSELLER1111111111111111111111111111111111111111111",
  remainingTenor: 45,
};

describe("AcceptTransferDialog", () => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  function getTestElement(testId: string) {
    return document.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
  }

  it("renders nothing when there is no item", () => {
    const { container } = render(
      <AcceptTransferDialog
        item={null}
        open={false}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it("renders the position summary and details", () => {
    render(
      <AcceptTransferDialog
        item={mockItem}
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(getTestElement("accept-transfer-invoice-number").textContent).toBe("INV-2026-001");
    expect(getTestElement("accept-transfer-confirm")).toBeInTheDocument();
  });

  it("calls onConfirm when the Accept Transfer button is clicked", () => {
    render(
      <AcceptTransferDialog
        item={mockItem}
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(getTestElement("accept-transfer-confirm"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    render(
      <AcceptTransferDialog
        item={mockItem}
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(getTestElement("accept-transfer-cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables the confirm button while the transaction is pending", () => {
    render(
      <AcceptTransferDialog
        item={mockItem}
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        status="signing"
      />,
    );

    expect(getTestElement("accept-transfer-confirm")).toBeDisabled();
  });

  it("shows an actionable NOT_IMPLEMENTED banner instead of alert() when the stub fails", () => {
    render(
      <AcceptTransferDialog
        item={mockItem}
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        status="failed"
        error="Buyer acceptance for transfer_position is not yet implemented"
      />,
    );

    const banner = getTestElement("accept-transfer-error-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("Buyer acceptance for transfer_position is not yet implemented");
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("does not show the error banner when there is no failure", () => {
    render(
      <AcceptTransferDialog
        item={mockItem}
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(getTestElement("accept-transfer-error-banner")).not.toBeInTheDocument();
  });

  it("closes automatically once the status reaches confirmed", () => {
    const { rerender } = render(
      <AcceptTransferDialog
        item={mockItem}
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        status="polling"
      />,
    );
    expect(onOpenChange).not.toHaveBeenCalled();

    rerender(
      <AcceptTransferDialog
        item={mockItem}
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        status="confirmed"
      />,
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
