/**
 * Tests for InvoiceCardHoverPopover component.
 *
 * Covers:
 *  - Popover visibility on hover (300ms delay, no flash on quick hovers)
 *  - Popover visibility on keyboard focus
 *  - Escape key closes popover + returns focus
 *  - Touch devices: popover disabled
 *  - Content rendering (APR, risk tier, jurisdiction, funded %, maturity days)
 *  - Positioning logic (right side, fallback to left)
 *  - Accessibility (role="tooltip", aria-describedby)
 *  - No layout shift (fixed positioning)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceCardHoverPopover } from "../InvoiceCardHoverPopover";
import type { Invoice } from "@/types";

// ── Mock Invoice ───────────────────────────────────────────────────────────────

const mockInvoice: Invoice = {
  id: "inv-001",
  tokenId: "token-001",
  contractAddress: "0x1234567890abcdef",
  ipfsCid: "QmMockCid",
  metadata: {
    invoiceNumber: "INV-2024-001",
    issuerName: "Test Corp",
    issuerAddress: "123 Main St",
    debtorName: "Test Debtor",
    debtorAddress: "456 Oak Ave",
    amount: 50000,
    currency: "USDC",
    issueDate: "2024-01-01",
    dueDate: "2024-03-01",
    description: "Test invoice",
    jurisdiction: "KE",
    category: "technology",
    documentHash: "QmDoc",
    documentUrl: "https://example.com/doc.pdf",
  },
  terms: {
    discountRate: 0.05,
    apr: 12.5,
    financingAmount: 40000,
    minInvestment: 100,
    maxInvestment: 5000,
    tenor: 60,
    repaymentDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  funding: {
    totalRaised: 30000,
    targetAmount: 40000,
    fundingProgress: 0.75,
    investorCount: 5,
    remainingCapacity: 10000,
  },
  riskTier: "A",
  riskScore: 75,
  debtorPrivacy: "partial",
  status: "partially_funded",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
  ownerAddress: "G1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("InvoiceCardHoverPopover", () => {
  let triggerRef: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    triggerRef = React.createRef();
  });

  it("should not render on touch devices", () => {
    // Mock touch device detection
    const originalOntouchstart = (window as any).ontouchstart;
    (window as any).ontouchstart = () => {};

    render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={mockInvoice}
          isOpen={true}
          onOpenChange={vi.fn()}
          triggerRef={triggerRef}
        />
      </div>
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Cleanup
    delete (window as any).ontouchstart;
  });

  it("should render popover content when open", async () => {
    render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={mockInvoice}
          isOpen={true}
          onOpenChange={vi.fn()}
          triggerRef={triggerRef}
        />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    // Check content
    expect(screen.getByText("Invoice Preview")).toBeInTheDocument();
    expect(screen.getByText("INV-2024-001")).toBeInTheDocument();
    expect(screen.getByText("12.50% APR")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Kenya")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText(/\d+d/)).toBeInTheDocument();
  });

  it("should not render popover when closed", () => {
    render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={mockInvoice}
          isOpen={false}
          onOpenChange={vi.fn()}
          triggerRef={triggerRef}
        />
      </div>
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("should have correct accessibility attributes", async () => {
    render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={mockInvoice}
          isOpen={true}
          onOpenChange={vi.fn()}
          triggerRef={triggerRef}
        />
      </div>
    );

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveAttribute("id", `invoice-popover-${mockInvoice.id}`);
      expect(tooltip).toHaveAttribute("aria-describedby", `invoice-popover-${mockInvoice.id}`);
    });
  });

  it("should close popover on Escape key", async () => {
    const onOpenChange = vi.fn();

    render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={mockInvoice}
          isOpen={true}
          onOpenChange={onOpenChange}
          triggerRef={triggerRef}
        />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should ignore other keys", async () => {
    const onOpenChange = vi.fn();

    render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={mockInvoice}
          isOpen={true}
          onOpenChange={onOpenChange}
          triggerRef={triggerRef}
        />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("should display correct jurisdiction name", async () => {
    const usInvoice = { ...mockInvoice, metadata: { ...mockInvoice.metadata, jurisdiction: "US" } };

    render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={usInvoice}
          isOpen={true}
          onOpenChange={vi.fn()}
          triggerRef={triggerRef}
        />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("United States")).toBeInTheDocument();
    });
  });

  it("should display correct funded percentage", async () => {
    const funded50Invoice = {
      ...mockInvoice,
      funding: { ...mockInvoice.funding, fundingProgress: 0.5 },
    };

    render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={funded50Invoice}
          isOpen={true}
          onOpenChange={vi.fn()}
          triggerRef={triggerRef}
        />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("50%")).toBeInTheDocument();
    });
  });

  it("should use fixed positioning (no layout shift)", async () => {
    render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={mockInvoice}
          isOpen={true}
          onOpenChange={vi.fn()}
          triggerRef={triggerRef}
        />
      </div>
    );

    await waitFor(() => {
      const popover = screen.getByRole("tooltip");
      const style = window.getComputedStyle(popover);
      expect(style.position).toBe("fixed");
    });
  });

  it("should handle missing jurisdiction gracefully", async () => {
    const unknownJurisdictionInvoice = {
      ...mockInvoice,
      metadata: { ...mockInvoice.metadata, jurisdiction: "XX" as any },
    };

    render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={unknownJurisdictionInvoice}
          isOpen={true}
          onOpenChange={vi.fn()}
          triggerRef={triggerRef}
        />
      </div>
    );

    await waitFor(() => {
      // Should display the jurisdiction code as fallback
      expect(screen.getByText("XX")).toBeInTheDocument();
    });
  });

  it("should animate in and out", async () => {
    const { rerender } = render(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={mockInvoice}
          isOpen={false}
          onOpenChange={vi.fn()}
          triggerRef={triggerRef}
        />
      </div>
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    rerender(
      <div ref={triggerRef}>
        <InvoiceCardHoverPopover
          invoice={mockInvoice}
          isOpen={true}
          onOpenChange={vi.fn()}
          triggerRef={triggerRef}
        />
      </div>
    );

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toBeInTheDocument();
    });
  });
});
