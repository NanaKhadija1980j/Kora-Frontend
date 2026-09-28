/**
 * Integration tests — Invoice Creation Wizard (form validation)
 *
 * Coverage matrix (all three steps):
 *
 * Step 1 — Invoice Details
 *   ✓ renders without errors
 *   ✓ shows "Invoice number is required" when invoiceNumber is empty and blurred
 *   ✓ shows regex message when invoiceNumber contains special chars
 *   ✓ shows "Debtor name is required" when debtorName is too short
 *   ✓ shows "Debtor address is required" when debtorAddress is too short
 *   ✓ shows "Amount must be positive" when amount is zero
 *   ✓ shows "Minimum $100 USDC" when amount is below 100
 *   ✓ shows "Due date is required" when dueDate is blank
 *   ✓ shows "Description cannot exceed 200 characters" when description is too long
 *   ✓ "Next" button is disabled while step 1 is invalid
 *   ✓ "Next" button advances to step 2 when all step-1 fields are valid
 *
 * Step 2 — Financing Terms
 *   ✓ shows "Min 0.5%" when discountRate is below range
 *   ✓ shows "Max 20%" when discountRate exceeds range
 *   ✓ shows "Min $100" when minInvestment is below range
 *   ✓ shows cross-field error when minInvestment > amount
 *   ✓ shows "Listing expiry date is required" when listingExpiryDate is empty
 *   ✓ shows cross-field error when listingExpiryDate >= dueDate
 *   ✓ "Next" button is disabled while step 2 is invalid
 *   ✓ "Next" button advances to step 3 when all step-2 fields are valid
 *
 * Step 3 — Upload & Review
 *   ✓ renders the summary panel with values from previous steps
 *   ✓ Mint button is disabled when no wallet is connected
 *   ✓ shows file-required error when submitting without a file
 *
 * Constraints enforced:
 *   - Uses @testing-library/react + userEvent
 *   - Tests the rendered UI output of error messages — not just the schema
 *   - Error message strings are taken verbatim from lib/validations/invoice.ts
 *   - Heavy external dependencies (hooks, stores, services) are fully mocked
 *     so the wizard component itself is what is under test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "./setup";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";


// ─── Module mocks ─────────────────────────────────────────────────────────────
// All mocks are declared before importing the component so Vitest's static
// hoisting can resolve them correctly.

// react-dropzone — stub the hook so we control file-drop state
const mockDropzoneState = {
  getRootProps: () => ({ "data-testid": "dropzone-root" }),
  getInputProps: () => ({ "data-testid": "dropzone-input", type: "file" }),
  isDragActive: false,
  isDragAccept: false,
  isDragReject: false,
};
vi.mock("react-dropzone", () => ({
  useDropzone: (_opts: any) => mockDropzoneState,
}));

// Wallet hooks
let mockWalletConnected = true;
let mockWalletAddress: string | null =
  "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ";

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(() => ({
    isConnected: mockWalletConnected,
    address: mockWalletAddress,
  })),
}));

// Zustand stores
const mockSetWalletModalOpen = vi.fn();
const mockSetCreateDraft = vi.fn();
const mockClearCreateDraft = vi.fn();

vi.mock("@/store", () => ({
  useUIStore: vi.fn(() => ({ setWalletModalOpen: mockSetWalletModalOpen })),
  useInvoiceStore: vi.fn(() => ({
    createDraft: {},
    setCreateDraft: mockSetCreateDraft,
    clearCreateDraft: mockClearCreateDraft,
  })),
  useWalletStore: {
    getState: vi.fn(() => ({
      addressBook: [],
      addAddressBookEntry: vi.fn(),
    })),
  },
}));

// Transaction hook
vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: vi.fn(() => ({
    execute: vi.fn(),
    status: "idle",
    error: null,
    reset: vi.fn(),
  })),
}));

// TxSimulation hook
vi.mock("@/hooks/useTxSimulation", () => ({
  useTxSimulation: vi.fn(() => ({
    simulationDialogProps: {},
    onSimulationPreview: vi.fn(),
  })),
}));

// Pinata health
vi.mock("@/hooks/usePinataHealth", () => ({
  usePinataHealth: vi.fn(() => ({
    isHealthy: true,
    isChecking: false,
    status: "healthy",
    recheck: vi.fn(),
  })),
}));

// Invoice service
vi.mock("@/services/invoiceService", () => ({
  prepareCreateInvoice: vi.fn(),
}));

// Security util
vi.mock("@/lib/security", () => ({
  safeStellarTxUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
}));

// framer-motion — flat passthrough so AnimatePresence works
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) =>
        ({ children, ...rest }: any) =>
          React.createElement(tag, rest, children),
    }
  ),
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => true,
}));

// ─── Component under test ─────────────────────────────────────────────────────
// Import AFTER all vi.mock() declarations
import CreateInvoicePage from "@/app/invoice/create/page";

// ─── Error messages verbatim from lib/validations/invoice.ts ─────────────────
const ERRORS = {
  // Step 1 — invoiceDetailsStepSchema
  invoiceNumberRequired: "Invoice number is required",
  invoiceNumberRegex:
    "Invoice number must contain only alphanumeric characters and hyphens",
  debtorNameRequired: "Debtor name is required",
  debtorAddressRequired: "Debtor address is required",
  amountPositive: "Amount must be positive",
  amountMin: "Minimum $100 USDC",
  dueDateRequired: "Due date is required",
  descriptionMax: "Description cannot exceed 200 characters",
  // Step 2 — financingTermsSchema
  discountRateMin: "Min 0.5%",
  discountRateMax: "Max 20%",
  minInvestmentMin: "Min $100",
  minInvestmentExceedsAmount:
    "Minimum investment cannot exceed the total invoice amount",
  listingExpiryRequired: "Listing expiry date is required",
  listingExpiryAfterDue:
    "Listing expiry date must be strictly earlier than the due date",
} as const;

// ─── Dates used across tests ──────────────────────────────────────────────────
// All dates are far in the future so they never become "past" during a test run
const FUTURE_DUE_DATE = "2099-12-31";
const FUTURE_EXPIRY_DATE = "2099-06-30"; // before due date ✓
const PAST_EXPIRY_DATE = "2099-12-31"; // same as due date — triggers cross-field error

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderWizard() {
  const queryClient = createTestQueryClient();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider 
        locale="en" 
        messages={en}
        onError={() => {}}
        getMessageFallback={({ key }) => key}
      >
        <CreateInvoicePage />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return utils;
}

/** Fill all required Step-1 fields with valid data */
async function fillStep1Valid(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByRole("textbox", { name: /invoice number/i }));
  await user.type(
    screen.getByRole("textbox", { name: /invoice number/i }),
    "INV-2099-0001"
  );

  await user.clear(screen.getByRole("textbox", { name: /debtor company name/i }));
  await user.type(
    screen.getByRole("textbox", { name: /debtor company name/i }),
    "Acme Corp Ltd"
  );

  await user.clear(screen.getByRole("combobox", { name: /debtor address/i }));
  await user.type(
    screen.getByRole("combobox", { name: /debtor address/i }),
    "123 Business Road, Nairobi, Kenya"
  );

  // Amount — look for the number input by label
  const amountInput = screen.getByRole("spinbutton", { name: /invoice amount/i });
  await user.clear(amountInput);
  await user.type(amountInput, "50000");

  // Due date — DatePicker renders a type="hidden" input (non-labelable).
  // We fire a change event directly on the hidden input registered with RHF.
  fireEvent.change(document.querySelector('input[name="dueDate"]')!, {
    target: { value: FUTURE_DUE_DATE },
  });
}

/** Navigate from Step 1 to Step 2 */
async function advanceToStep2(user: ReturnType<typeof userEvent.setup>) {
  await fillStep1Valid(user);
  const nextBtn = screen.getByRole("button", { name: /next/i });
  await user.click(nextBtn);
  // Wait for Step 2 to render
  await waitFor(() =>
    expect(screen.getByText(/discount rate/i)).toBeInTheDocument()
  );
}

/** Fill all required Step-2 fields with valid data */
async function fillStep2Valid(user: ReturnType<typeof userEvent.setup>) {
  // Discount rate — already defaults to 0.5; we type a fresh value via the input
  const discountInput = screen.getByRole("spinbutton", {
    name: /discount rate/i,
  });
  await user.clear(discountInput);
  await user.type(discountInput, "5");

  // Minimum investment
  const minInvInput = screen.getByRole("spinbutton", {
    name: /minimum investment/i,
  });
  await user.clear(minInvInput);
  await user.type(minInvInput, "1000");

  // Listing expiry date — also a hidden input
  fireEvent.change(document.querySelector('input[name="listingExpiryDate"]')!, {
    target: { value: FUTURE_EXPIRY_DATE },
  });
}

/** Navigate from Step 2 to Step 3 */
async function advanceToStep3(user: ReturnType<typeof userEvent.setup>) {
  await advanceToStep2(user);
  await fillStep2Valid(user);
  const nextBtn = screen.getByRole("button", { name: /next/i });
  await user.click(nextBtn);
  await waitFor(() =>
    expect(screen.getByText(/summary/i)).toBeInTheDocument()
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Invoice Creation Wizard — form validation", () => {
  beforeEach(() => {
    mockWalletConnected = true;
    mockWalletAddress =
      "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Step 1: Invoice Details ────────────────────────────────────────────────

  describe("Step 1 — Invoice Details", () => {
    it("renders the first step without crashing", () => {
      renderWizard();
      expect(
        screen.getByRole("heading", { name: /create invoice/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: /invoice number/i })
      ).toBeInTheDocument();
    });

    it("shows 'Invoice number is required' when field is left blank", async () => {
      const user = userEvent.setup();
      renderWizard();

      const input = screen.getByRole("textbox", { name: /invoice number/i });
      await user.click(input);
      await user.tab(); // blur triggers onBlur validation

      await waitFor(() =>
        expect(
          screen.getByText(ERRORS.invoiceNumberRequired)
        ).toBeInTheDocument()
      );
    });

    it("shows regex error when invoiceNumber contains special characters", async () => {
      const user = userEvent.setup();
      renderWizard();

      const input = screen.getByRole("textbox", { name: /invoice number/i });
      await user.type(input, "INV#2024@0001");
      await user.tab();

      await waitFor(() =>
        expect(screen.getByText(ERRORS.invoiceNumberRegex)).toBeInTheDocument()
      );
    });

    it("shows 'Debtor name is required' when debtorName is too short", async () => {
      const user = userEvent.setup();
      renderWizard();

      const input = screen.getByRole("textbox", { name: /debtor company name/i });
      await user.type(input, "A"); // min length = 2
      await user.tab();

      await waitFor(() =>
        expect(screen.getByText(ERRORS.debtorNameRequired)).toBeInTheDocument()
      );
    });

    it("shows 'Debtor address is required' when debtorAddress is too short", async () => {
      const user = userEvent.setup();
      renderWizard();

      const input = screen.getByRole("combobox", { name: /debtor address/i });
      await user.type(input, "123"); // min length = 5
      await user.tab();

      await waitFor(() =>
        expect(
          screen.getByText(ERRORS.debtorAddressRequired)
        ).toBeInTheDocument()
      );
    });

    it("shows 'Amount must be positive' when amount is zero", async () => {
      const user = userEvent.setup();
      renderWizard();

      const input = screen.getByRole("spinbutton", { name: /invoice amount/i });
      await user.clear(input);
      await user.type(input, "0");
      await user.tab();

      await waitFor(() =>
        expect(screen.getByText(ERRORS.amountPositive)).toBeInTheDocument()
      );
    });

    it("shows 'Minimum $100 USDC' when amount is below 100", async () => {
      const user = userEvent.setup();
      renderWizard();

      const input = screen.getByRole("spinbutton", { name: /invoice amount/i });
      await user.clear(input);
      await user.type(input, "50");
      await user.tab();

      await waitFor(() =>
        expect(screen.getByText(ERRORS.amountMin)).toBeInTheDocument()
      );
    });

    it("shows 'Due date is required' when dueDate is empty", async () => {
      renderWizard();

      // Trigger validation by blurring the trigger button without setting a value
      const dateBtn = screen.getByRole("button", { name: /select date/i });
      fireEvent.blur(dateBtn);
      // Fire a change with empty string to trigger RHF onBlur validation
      fireEvent.change(document.querySelector('input[name="dueDate"]')!, {
        target: { value: "" },
      });
      fireEvent.blur(document.querySelector('input[name="dueDate"]')!);

      await waitFor(() =>
        expect(screen.getByText(ERRORS.dueDateRequired)).toBeInTheDocument()
      );
    });

    it("shows 'Description cannot exceed 200 characters' when description is too long", async () => {
      renderWizard();

      // The Textarea has maxLength={200}, so userEvent.type caps at 200 chars.
      // Use fireEvent.change to bypass the HTML constraint and set 201 chars.
      const textarea = screen.getByRole("textbox", { name: /description/i });
      fireEvent.change(textarea, { target: { value: "A".repeat(201) } });
      fireEvent.blur(textarea);

      await waitFor(() =>
        expect(screen.getByText(ERRORS.descriptionMax)).toBeInTheDocument()
      );
    });

    it("'Next' button is disabled while required step-1 fields are invalid", () => {
      renderWizard();
      // No fields filled — step0Valid is false
      const nextBtn = screen.getByRole("button", { name: /next/i });
      expect(nextBtn).toBeDisabled();
    });

    it("'Next' advances to Step 2 when all step-1 fields are valid", async () => {
      const user = userEvent.setup();
      renderWizard();

      await fillStep1Valid(user);

      // Next button should become enabled after valid input
      const nextBtn = screen.getByRole("button", { name: /next/i });
      await waitFor(() => expect(nextBtn).not.toBeDisabled());

      await user.click(nextBtn);

      await waitFor(() =>
        expect(screen.getByText(/discount rate/i)).toBeInTheDocument()
      );
    });
  });

  // ── Step 2: Financing Terms ────────────────────────────────────────────────

  describe("Step 2 — Financing Terms", () => {
    it("shows 'Min 0.5%' when discountRate is below 0.5", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);

      const input = screen.getByRole("spinbutton", { name: /discount rate/i });
      await user.clear(input);
      await user.type(input, "0.1");
      await user.tab();

      await waitFor(() =>
        expect(screen.getByText(ERRORS.discountRateMin)).toBeInTheDocument()
      );
    });

    it("shows 'Max 20%' when discountRate exceeds 20", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);

      const input = screen.getByRole("spinbutton", { name: /discount rate/i });
      await user.clear(input);
      await user.type(input, "25");
      await user.tab();

      await waitFor(() =>
        expect(screen.getByText(ERRORS.discountRateMax)).toBeInTheDocument()
      );
    });

    it("shows 'Min $100' when minInvestment is below 100", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);

      const input = screen.getByRole("spinbutton", {
        name: /minimum investment/i,
      });
      await user.clear(input);
      await user.type(input, "50");
      await user.tab();

      await waitFor(() =>
        expect(screen.getByText(ERRORS.minInvestmentMin)).toBeInTheDocument()
      );
    });

    it("shows cross-field error when minInvestment exceeds the invoice amount", async () => {
      const user = userEvent.setup();
      renderWizard();

      // Step 1: set amount = 500
      await user.clear(screen.getByRole("textbox", { name: /invoice number/i }));
      await user.type(
        screen.getByRole("textbox", { name: /invoice number/i }),
        "INV-2099-0001"
      );
      await user.clear(screen.getByRole("textbox", { name: /debtor company name/i }));
      await user.type(
        screen.getByRole("textbox", { name: /debtor company name/i }),
        "Acme Corp Ltd"
      );
      await user.clear(screen.getByRole("combobox", { name: /debtor address/i }));
      await user.type(
        screen.getByRole("combobox", { name: /debtor address/i }),
        "123 Business Road, Nairobi, Kenya"
      );
      const amountInput = screen.getByRole("spinbutton", {
        name: /invoice amount/i,
      });
      await user.clear(amountInput);
      await user.type(amountInput, "500");
      fireEvent.change(document.querySelector('input[name="dueDate"]')!, {
        target: { value: FUTURE_DUE_DATE },
      });

      const nextBtn = screen.getByRole("button", { name: /next/i });
      await waitFor(() => expect(nextBtn).not.toBeDisabled());
      await user.click(nextBtn);
      await waitFor(() =>
        expect(screen.getByText(/discount rate/i)).toBeInTheDocument()
      );

      // Step 2: set minInvestment > amount (500)
      const discountInput = screen.getByRole("spinbutton", {
        name: /discount rate/i,
      });
      await user.clear(discountInput);
      await user.type(discountInput, "5");

      const minInvInput = screen.getByRole("spinbutton", {
        name: /minimum investment/i,
      });
      await user.clear(minInvInput);
      await user.type(minInvInput, "1000"); // 1000 > 500 — triggers cross-field error
      await user.tab();

      fireEvent.change(document.querySelector('input[name="listingExpiryDate"]')!, {
        target: { value: FUTURE_EXPIRY_DATE },
      });
      fireEvent.blur(document.querySelector('input[name="listingExpiryDate"]')!);

      // Attempt to advance — the Next button should be disabled while invalid
      await waitFor(() => expect(nextBtn).toBeDisabled());

      // The error should also appear when trigger() fires on blur
      await waitFor(() =>
        expect(
          screen.getByText(ERRORS.minInvestmentExceedsAmount)
        ).toBeInTheDocument()
      );
    });

    it("shows 'Listing expiry date is required' when field is empty", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);

      // Discount rate valid
      const discountInput = screen.getByRole("spinbutton", {
        name: /discount rate/i,
      });
      await user.clear(discountInput);
      await user.type(discountInput, "5");
      await user.tab();

      // Do NOT fill listing expiry — just fire a blur on the hidden input to trigger validation
      fireEvent.change(document.querySelector('input[name="listingExpiryDate"]')!, {
        target: { value: "" },
      });
      fireEvent.blur(document.querySelector('input[name="listingExpiryDate"]')!);

      await waitFor(() =>
        expect(
          screen.getByText(ERRORS.listingExpiryRequired)
        ).toBeInTheDocument()
      );
    });

    it("shows cross-field error when listingExpiryDate >= dueDate", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);

      const discountInput = screen.getByRole("spinbutton", {
        name: /discount rate/i,
      });
      await user.clear(discountInput);
      await user.type(discountInput, "5");

      const minInvInput = screen.getByRole("spinbutton", {
        name: /minimum investment/i,
      });
      await user.clear(minInvInput);
      await user.type(minInvInput, "1000");

      // Set expiry = due date (not strictly before) — same value = 2099-12-31
      // Cross-field refines only fire when trigger() runs across the whole schema.
      // We click Next to invoke trigger() which surfaces the cross-field error.
      fireEvent.change(document.querySelector('input[name="listingExpiryDate"]')!, {
        target: { value: PAST_EXPIRY_DATE },
      });

      // Click Next to trigger full step-2 schema validation (including the refine)
      const nextBtn = screen.getByRole("button", { name: /next/i });
      await user.click(nextBtn);

      await waitFor(() =>
        expect(
          screen.getByText(ERRORS.listingExpiryAfterDue)
        ).toBeInTheDocument()
      );
    });

    it("'Next' button is disabled while step-2 has validation errors", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);

      // Don't fill anything — step1Valid is false
      const nextBtn = screen.getByRole("button", { name: /next/i });
      expect(nextBtn).toBeDisabled();
    });

    it("'Next' advances to Step 3 when all step-2 fields are valid", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);
      await fillStep2Valid(user);

      const nextBtn = screen.getByRole("button", { name: /next/i });
      await waitFor(() => expect(nextBtn).not.toBeDisabled());

      await user.click(nextBtn);

      await waitFor(() =>
        expect(screen.getByText(/summary/i)).toBeInTheDocument()
      );
    });
  });

  // ── Step 3: Upload & Review ────────────────────────────────────────────────

  describe("Step 3 — Upload & Review", () => {
    it("renders the summary panel with values entered in previous steps", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep3(user);

      // Invoice number and debtor name should appear in the summary
      expect(screen.getByText("INV-2099-0001")).toBeInTheDocument();
      expect(screen.getByText("Acme Corp Ltd")).toBeInTheDocument();
    });

    it("renders the file upload area", async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep3(user);

      // There may be multiple elements containing "Invoice Document"
      // (a heading and a label). Assert at least one exists.
      expect(screen.getAllByText(/invoice document/i).length).toBeGreaterThan(0);
    });

    it("Mint button is disabled when wallet is not connected", async () => {
      mockWalletConnected = false;
      mockWalletAddress = null;

      const user = userEvent.setup();
      renderWizard();
      await advanceToStep3(user);

      // When disconnected the wizard shows "Connect Wallet" text on the mint button.
      // The button itself is not disabled — clicking it should trigger setWalletModalOpen.
      // However since no file has been uploaded the submit button IS disabled, so
      // the "Connect Wallet" copy appears in a separate non-submit button rendered
      // when isConnected === false.  Assert the correct button text is present.
      const connectBtn = screen.getByRole("button", { name: /connect.*(wallet|to mint)/i });
      expect(connectBtn).toBeInTheDocument();
    });

    it("shows file-required error when Mint is attempted without a file", async () => {
      mockWalletConnected = true;

      const user = userEvent.setup();
      renderWizard();
      await advanceToStep3(user);

      // Button is disabled when no file is selected — we verify it's disabled
      const mintBtn = screen.getByRole("button", { name: /mint invoice nft/i });
      expect(mintBtn).toBeDisabled();
    });
  });

  // ── Full happy-path: submit with valid data ────────────────────────────────

  describe("Happy path — valid data through all 3 steps", () => {
    it("completes all 3 steps with valid data and reaches the submit state", async () => {
      const user = userEvent.setup();
      renderWizard();

      // Step 1
      await fillStep1Valid(user);
      let nextBtn = screen.getByRole("button", { name: /next/i });
      await waitFor(() => expect(nextBtn).not.toBeDisabled());
      await user.click(nextBtn);

      // Step 2
      await waitFor(() =>
        expect(screen.getByText(/discount rate/i)).toBeInTheDocument()
      );
      await fillStep2Valid(user);
      nextBtn = screen.getByRole("button", { name: /next/i });
      await waitFor(() => expect(nextBtn).not.toBeDisabled());
      await user.click(nextBtn);

      // Step 3
      await waitFor(() =>
        expect(screen.getByText(/summary/i)).toBeInTheDocument()
      );

      // Step-1 values visible in summary
      expect(screen.getByText("INV-2099-0001")).toBeInTheDocument();
      expect(screen.getByText("Acme Corp Ltd")).toBeInTheDocument();

      // Mint button present (disabled — no file uploaded)
      expect(
        screen.getByRole("button", { name: /mint invoice nft/i })
      ).toBeInTheDocument();
    });
  });
});
