import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListPositionDialog } from "@/components/invoice/ListPositionDialog";
import type { InvestorPosition } from "@/types/invoice";

// Mock the formatters hook
jest.mock("@/hooks/useFormatters", () => ({
  useFormatters: () => ({
    formatCurrency: (value: number, currency = "USDC") => `${currency} ${value.toFixed(2)}`,
    formatPercentage: (value: number, decimals = 2) => `${value.toFixed(decimals)}%`,
  }),
});

// Mock the computeImpliedDiscount function
jest.mock("@/types/invoice", () => ({
  ...jest.requireActual("@/types/invoice"),
  computeImpliedDiscount: (askPrice: number, expectedReturn: number) => {
    if (expectedReturn <= 0) return 0;
    return (expectedReturn - askPrice) / expectedReturn;
  },
});

// Mock the UI components
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, onOpenChange, children }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: any) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children, className }: any) => <h2 data-testid="dialog-title" className={className}>{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, variant, ...props }: any) => (
    <button data-testid="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/number-input", () => ({
  NumberInput: ({ value, onChange, error, ...props }: any) => (
    <input
      data-testid="number-input"
      value={value}
      onChange={onChange}
      aria-invalid={!!error}
      aria-describedby={error ? "error-message" : undefined}
      {...props}
    />
  ),
});

jest.mock("@/hooks/useFormatters", () => ({
  useFormatters: () => ({
    formatCurrency: (value: number, currency = "USDC") => `${currency} ${value.toFixed(2)}`,
    formatPercentage: (value: number, decimals = 2) => `${value.toFixed(2)}%`,
  }),
});

const mockPosition = {
  id: "pos_123",
  invoiceId: "inv_123",
  investedAmount: 1000,
  expectedReturn: 1100,
  yieldEarned: 100,
  investedAt: "2024-01-01T00:00:00Z",
  status: "active" as const,
  invoice: {
    id: "inv_123",
    tokenId: "123",
    contractAddress: "C123",
    ipfsCid: "QmTest",
    metadata: {
      invoiceNumber: "INV-001",
      issuerName: "Test Corp",
      issuerAddress: "G...",
      debtorName: "Debtor Inc",
      debtorAddress: "G...",
      amount: 1000,
      currency: "USDC",
      issueDate: "2024-01-01T00:00:00Z",
      dueDate: "2025-01-01T00:00:00Z",
      description: "Test invoice",
      jurisdiction: "US",
      category: "technology",
      documentHash: "QmTest",
      documentUrl: "https://example.com",
    },
    terms: {
      discountRate: 0.1,
      apr: 10,
      financingAmount: 1000,
      minInvestment: 100,
      maxInvestment: 1000,
      tenor: 365,
      repaymentDate: "2025-01-01T00:00:00Z",
    },
    funding: {
      totalRaised: 1000,
      targetAmount: 1000,
      fundingProgress: 1,
      investorCount: 1,
      remainingCapacity: 0,
    },
    riskTier: "A",
    riskScore: 90,
    debtorPrivacy: "full",
    status: "active" as const,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ownerAddress: "G...",
  } as any,
};

describe("ListPositionDialog", () => {
  const defaultProps = {
    position: {
      id: "pos_123",
      invoiceId: "inv_123",
      investedAmount: 1000,
      expectedReturn: 1100,
      yieldEarned: 100,
      investedAt: "2024-01-01T00:00:00Z",
      status: "active" as const,
      invoice: {
        id: "inv_123",
        tokenId: "123",
        contractAddress: "C123",
        ipfsCid: "QmTest",
        metadata: {
          invoiceNumber: "INV-001",
          issuerName: "Test Corp",
          issuerAddress: "G...",
          debtorName: "Debtor Inc",
          debtorAddress: "G...",
          amount: 1000,
          currency: "USDC",
          issueDate: "2024-01-01T00:00:00Z",
          dueDate: "2025-01-01T00:00:00Z",
          description: "Test invoice",
          jurisdiction: "US",
          category: "technology",
          documentHash: "QmTest",
          documentUrl: "https://example.com",
        },
        terms: {
          discountRate: 0.1,
          apr: 10,
          financingAmount: 1000,
          minInvestment: 100,
          maxInvestment: 1000,
          tenor: 365,
          repaymentDate: "2025-01-01T00:00:00Z",
        },
        funding: {
          totalRaised: 1000,
          targetAmount: 1000,
          fundingProgress: 1,
          investorCount: 1,
          remainingCapacity: 0,
        },
        riskTier: "A",
        riskScore: 90,
        debtorPrivacy: "full" as const,
        status: "active" as const,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        ownerAddress: "G...",
      } as any,
    },
    open: true,
    onOpenChange: jest.fn(),
    onSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dialog when open is true", () => {
    render(<ListPositionDialog {...defaultProps} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("List position for sale");
  });

  it("does not render when position is null", () => {
    render(<ListPositionDialog {...defaultProps} position={null} />);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("renders expected return in description", () => {
    render(<ListPositionDialog {...defaultProps} />);
    expect(screen.getByText("Expected return: USDC 1100.00")).toBeInTheDocument();
  });

  it("shows error when ask price is empty and user tries to submit", async () => {
    const user = userEvent.setup();
    render(<ListPositionDialog {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: /list for sale/i });
    await userEvent.click(submitButton);

    // Should not call onSubmit
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("shows error when ask price is invalid", async () => {
    const user = userEvent.setup();
    render(<ListPositionDialog {...defaultProps} />);

    const input = screen.getByTestId("number-input");
    await userEvent.type(input, "abc");
    await userEvent.click(screen.getByRole("button", { name: /list for sale/i }));

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("shows validation error when ask price is too low", async () => {
    const user = userEvent.setup();
    render(<ListPositionDialog {...defaultProps} />);

    const input = screen.getByTestId("number-input");
    await userEvent.type(input, "50"); // Too low (below 10% of expected return)
    await userEvent.click(screen.getByRole("button", { name: /list for sale/i }));

    await waitFor(() => {
      expect(screen.getByText(/must be between/)).toBeInTheDocument();
    });
  });

  it("shows warning when ask price is too high", async () => {
    const user = userEvent.setup();
    render(<ListPositionDialog {...defaultProps} />);

    const input = screen.getByTestId("number-input");
    await userEvent.type(input, "3000"); // Too high (above 200% of expected return)
    await userEvent.click(screen.getByRole("button", { name: /list for sale/i }));

    await waitFor(() => {
      expect(screen.getByText(/must be between/)).toBeInTheDocument();
    });
  });

  it("shows implied discount preview when valid price entered", async () => {
    const user = userEvent.setup();
    render(<ListPositionDialog {...defaultProps} />);

    const input = screen.getByTestId("number-input");
    await userEvent.type(input, "1000"); // Valid price, 9.09% discount

    await waitFor(() => {
      expect(screen.getByText("Implied discount")).toBeInTheDocument();
      expect(screen.getByText("9.09%")).toBeInTheDocument();
      expect(screen.getByText("Buyer receives a discount versus your expected return.")).toBeInTheDocument();
    });
  });

  it("shows premium warning when ask price above expected return", async () => {
    const user = userEvent.setup();
    render(<ListPositionDialog {...defaultProps} />);

    const input = screen.getByTestId("number-input");
    await userEvent.type(input, "1200"); // Above expected return (premium)

    await waitFor(() => {
      expect(screen.getByText("You're asking above your expected return (premium).")).toBeInTheDocument();
    });
  });

  it("calls onSubmit with parsed ask price when valid", async () => {
    const user = userEvent.setup();
    render(<ListPositionDialog {...defaultProps} />);

    const input = screen.getByTestId("number-input");
    await userEvent.type(input, "1000");
    await userEvent.click(screen.getByRole("button", { name: /list for sale/i }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(1000);
    });
  });

  it("shows suggested price range guidance", () => {
    render(<ListPositionDialog {...defaultProps} />);
    expect(screen.getByText(/Suggested range:/)).toBeInTheDocument();
    expect(screen.getByText("USDC 110.00 - USDC 2200.00")).toBeInTheDocument();
  });

  it("closes dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<ListPositionDialog {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("clears ask price after successful submit", async () => {
    const user = userEvent.setup();
    render(<ListPositionDialog {...defaultProps} />);

    const input = screen.getByTestId("number-input");
    await userEvent.type(input, "1000");
    await userEvent.click(screen.getByRole("button", { name: /list for sale/i }));

    await waitFor(() => {
      expect((screen.getByTestId("number-input") as HTMLInputElement).value).toBe("");
    });
  });

  it("closes dialog on cancel", () => {
    render(<ListPositionDialog {...defaultProps} />);
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});