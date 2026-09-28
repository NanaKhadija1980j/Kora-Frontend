/**
 * Component tests for StatusTransitionButtons (#672).
 *
 * Covers:
 *  - listed / fully_funded / repaid status fixtures
 *  - Non-owner: all buttons disabled + blocked tooltip reason
 *  - Destructive cancel opens CancelInvoiceDialog
 *  - Non-destructive confirm opens simulation preview path via useTransaction
 *  - No real network / contract calls
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusTransitionButtons } from "@/components/invoice/StatusTransitionButtons";
import type { Invoice } from "@/types";
import type { InvoiceStatus } from "@/types/invoice";
import type { SimulationPreview } from "@/hooks/useTransaction";

const executeMock = vi.fn();
const onSimulationPreviewMock = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    if (key === "confirmTitle") return `Confirm: ${params?.label ?? ""}`;
    if (key === "confirmBody") {
      return `Invoice ${params?.invoiceNumber} will be moved from ${params?.from} to ${params?.to}.`;
    }
    if (key === "onChainWarning") return "This action is recorded on-chain and cannot be reversed.";
    if (key === "goBack") return "Go back";
    if (key === "confirm") return "Confirm";
    if (key === "processing") return "Processing…";
    return key;
  },
}));

vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: () => ({
    execute: executeMock,
    status: "idle",
  }),
}));

vi.mock("@/hooks/useTxSimulation", () => ({
  useTxSimulation: () => ({
    simulationDialogProps: {
      open: false,
      preview: null,
      onProceed: vi.fn(),
      onCancel: vi.fn(),
    },
    onSimulationPreview: onSimulationPreviewMock,
  }),
}));

vi.mock("@/hooks/useFormatters", () => ({
  useFormatters: () => ({
    formatCurrency: (val: number, curr?: string) => `$${val} ${curr || "USDC"}`,
    formatDate: (d: string) => d,
  }),
}));

vi.mock("@radix-ui/react-tooltip", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Provider: Passthrough,
    Root: Passthrough,
    Trigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Portal: Passthrough,
    Content: ({ children }: { children?: React.ReactNode }) => (
      <div role="tooltip">{children}</div>
    ),
    Arrow: () => null,
  };
});

function makeInvoice(status: InvoiceStatus, ownerAddress = "GOWNER1234"): Invoice {
  return {
    id: `inv-${status}`,
    tokenId: "tok-001",
    contractAddress: "GABC1234CONTRACTADDRESS",
    ipfsCid: "QmExampleCid",
    metadata: {
      invoiceNumber: "INV-2024-001",
      issuerName: "Acme Corp Ltd",
      issuerAddress: "GISSUER1234",
      debtorName: "Global Buyers Inc",
      debtorAddress: "123 Business Way, New York, NY 10001",
      amount: 50000,
      currency: "USDC",
      issueDate: "2024-01-15T00:00:00Z",
      dueDate: "2024-07-15T00:00:00Z",
      description: "Technology services invoice Q1 2024",
      jurisdiction: "US",
      category: "technology",
      documentHash: "QmDocHash",
      documentUrl: "https://ipfs.io/ipfs/QmDocHash",
    },
    terms: {
      discountRate: 0.06,
      apr: 14.5,
      financingAmount: 47000,
      minInvestment: 1000,
      maxInvestment: 10000,
      tenor: 180,
      repaymentDate: "2024-07-15T00:00:00Z",
    },
    funding: {
      totalRaised: status === "listed" ? 0 : 47000,
      targetAmount: 47000,
      fundingProgress: status === "listed" ? 0 : 1,
      investorCount: status === "listed" ? 0 : 3,
      remainingCapacity: status === "listed" ? 47000 : 0,
    },
    riskTier: "A",
    riskScore: 82,
    debtorPrivacy: "full",
    status,
    createdAt: "2024-01-10T00:00:00Z",
    updatedAt: "2024-01-16T00:00:00Z",
    ownerAddress,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("StatusTransitionButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeMock.mockResolvedValue("mock_tx_hash");
    onSimulationPreviewMock.mockResolvedValue(true);
  });

  it("renders listed transitions for the owner (fund + cancel)", () => {
    renderWithQuery(
      <StatusTransitionButtons
        invoice={makeInvoice("listed")}
        walletAddress="GOWNER1234"
      />
    );

    expect(screen.getByTestId("status-btn-fully_funded")).toBeEnabled();
    expect(screen.getByTestId("status-btn-cancelled")).toBeEnabled();
    expect(screen.getByText("Mark as Funded")).toBeInTheDocument();
    expect(screen.getByText("Cancel Invoice")).toBeInTheDocument();
  });

  it("renders fully_funded repay transition for the owner", () => {
    renderWithQuery(
      <StatusTransitionButtons
        invoice={makeInvoice("fully_funded")}
        walletAddress="GOWNER1234"
      />
    );

    expect(screen.getByTestId("status-btn-repaid")).toBeEnabled();
    expect(screen.getByText("Mark as Repaid")).toBeInTheDocument();
    expect(screen.queryByTestId("status-btn-cancelled")).not.toBeInTheDocument();
  });

  it("hides all buttons for repaid (terminal) status", () => {
    const { container } = renderWithQuery(
      <StatusTransitionButtons
        invoice={makeInvoice("repaid")}
        walletAddress="GOWNER1234"
      />
    );

    expect(container.querySelector("[data-testid^='status-btn-']")).toBeNull();
  });

  it("disables all buttons for non-owner and shows owner-only tooltip", () => {
    renderWithQuery(
      <StatusTransitionButtons
        invoice={makeInvoice("listed")}
        walletAddress="GOTHER9999"
      />
    );

    expect(screen.getByTestId("status-btn-fully_funded")).toBeDisabled();
    expect(screen.getByTestId("status-btn-cancelled")).toBeDisabled();
    expect(
      screen.getAllByText("Only the invoice owner can trigger status changes.").length
    ).toBeGreaterThan(0);
  });

  it("opens CancelInvoiceDialog for destructive cancel", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <StatusTransitionButtons
        invoice={makeInvoice("listed")}
        walletAddress="GOWNER1234"
      />
    );

    await user.click(screen.getByTestId("status-btn-cancelled"));

    expect(await screen.findByTestId("cancel-invoice-confirm")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-reason-select")).toBeInTheDocument();
  });

  it("opens inline confirm and calls useTransaction.execute with simulation preview", async () => {
    const user = userEvent.setup();
    const preview: SimulationPreview = {
      feeStroops: 100,
      feeXlm: 0.00001,
      resourceFee: 50,
      cpuInstructions: 1000,
      memoryBytes: 512,
      readBytes: 256,
      writeBytes: 128,
    };

    executeMock.mockImplementation(async (_buildFn, options) => {
      if (options?.onSimulationPreview) {
        await options.onSimulationPreview(preview);
      }
      return "mock_tx_hash";
    });

    renderWithQuery(
      <StatusTransitionButtons
        invoice={makeInvoice("listed")}
        walletAddress="GOWNER1234"
      />
    );

    await user.click(screen.getByTestId("status-btn-fully_funded"));

    const confirmDialog = await screen.findByRole("dialog");
    expect(
      within(confirmDialog).getByText(
        /Invoice INV-2024-001 will be moved from listed to fully funded/
      )
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("inline-confirm-btn"));

    await waitFor(() => {
      expect(executeMock).toHaveBeenCalledTimes(1);
    });

    expect(onSimulationPreviewMock).toHaveBeenCalledWith(preview);
    const executeOptions = executeMock.mock.calls[0][1];
    expect(executeOptions.onSimulationPreview).toBe(onSimulationPreviewMock);
  });
});
