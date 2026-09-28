/// <reference types="@testing-library/jest-dom" />
/**
 * KYB Gate Tests — Issue #489
 *
 * Covers the `kyb-mint-gate` feature flag behaviour in the Create Invoice wizard:
 *
 *  1. Flag OFF  → unverified user can advance from step 1 → step 2 unimpeded.
 *  2. Flag ON + kycStatus "none"     → KybGateScreen is shown, step 2 is not.
 *  3. Flag ON + kycStatus "pending"  → KybGateScreen shows the pending badge.
 *  4. Flag ON + kycStatus "rejected" → KybGateScreen shows re-verify CTA.
 *  5. Flag ON + kycStatus "verified" → wizard advances normally, no gate shown.
 *  6. Polling auto-advance → status "pending" → "verified" removes gate and
 *     shows step 2 content.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Hoisted variables ─────────────────────────────────────────────────────────

const { mockSetWalletModalOpen, mockUseWalletStore } = vi.hoisted(() => {
  const { create } = require("zustand");
  const useWalletStore = create<any>()(() => ({
    addressBook: [],
    address: "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE",
    isConnected: true,
    isVerified: false,
    kycStatus: "none",
    connect: vi.fn(),
    disconnect: vi.fn(),
    setBalance: vi.fn(),
    setVerified: vi.fn(),
    clearVerification: vi.fn(),
    isVerificationExpired: vi.fn(() => true),
    addAddressBookEntry: vi.fn(),
    setKycStatus: vi.fn((status: string) =>
      useWalletStore.setState({ kycStatus: status })
    ),
  }));

  return {
    mockSetWalletModalOpen: vi.fn(),
    mockUseWalletStore: useWalletStore,
  };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

import enMessages from "@/messages/en.json";

function getNestedValue(obj: any, path: string): string {
  const parts = path.split(".");
  let curr = obj;
  for (const part of parts) {
    if (curr && typeof curr === "object" && part in curr) {
      curr = curr[part];
    } else {
      return path;
    }
  }
  return typeof curr === "string" ? curr : path;
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    let res = getNestedValue(enMessages, fullKey);
    if (!values) return res;
    return res.replace(/\{(.*?)\}/g, (_, group) => String(values[group] ?? `{${group}}`));
  },
  useLocale: () => "en",
}));

vi.mock("@/store/walletStore", () => ({
  useWalletStore: mockUseWalletStore,
  useWalletKycStatus: () => mockUseWalletStore((s: any) => s.kycStatus),
}));

vi.mock("@/lib/featureFlags", () => ({
  useFeatureFlag: vi.fn(() => false), // disabled by default; tests override per-case
  useFeatureFlags: vi.fn(() => ({})),
  isEnabled: vi.fn(() => false),
  getFeatureFlagState: vi.fn(() => ({})),
}));

vi.mock("@/lib/ipfs", () => ({
  uploadFileToPinata: vi.fn().mockResolvedValue("QmMockPdfCid"),
  uploadInvoiceMetadata: vi.fn().mockResolvedValue("QmMockMetaCid"),
  uploadInvoicePDF: vi.fn().mockResolvedValue("QmMockPdfCid"),
  validateCid: vi.fn(),
  checkPinataHealth: vi.fn().mockResolvedValue(true),
  ipfsUrl: vi.fn((cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`),
}));

vi.mock("@/components/ui/date-picker", () => {
  const React = require("react");
  const DatePicker = React.forwardRef(({ label, id, name, onChange, value, defaultValue, ...props }: any, ref: any) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-") || "dp";
    return (
      <div>
        {label && <label htmlFor={inputId}>{label}</label>}
        <input type="date" id={inputId} name={name} ref={ref} value={value} defaultValue={defaultValue} onChange={onChange} {...props} />
      </div>
    );
  });
  DatePicker.displayName = "DatePicker";
  return { DatePicker };
});

vi.mock("@/components/ui/select", () => {
  const React = require("react");
  const Select = React.forwardRef(({ label, id, name, options = [], onChange, value, defaultValue, ...props }: any, ref: any) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-") || "sel";
    const flatOptions: any[] = [];
    (options as any[]).forEach((opt: any) => {
      if (opt && typeof opt === "object" && "options" in opt && Array.isArray(opt.options)) {
        opt.options.forEach((sub: any) => flatOptions.push(sub));
      } else if (opt) {
        flatOptions.push(opt);
      }
    });
    return (
      <div>
        {label && <label htmlFor={selectId}>{label}</label>}
        <select id={selectId} name={name} ref={ref} value={value} defaultValue={defaultValue} onChange={onChange} {...props}>
          <option value="">Select option...</option>
          {flatOptions.map((opt: any) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  });
  Select.displayName = "Select";
  return { Select };
});

vi.mock("@/lib/stellar/contracts", () => ({
  invoiceContract: { mintInvoice: vi.fn().mockResolvedValue("mock_xdr") },
  marketplaceContract: { fundInvoice: vi.fn(), repayInvoice: vi.fn() },
}));

vi.mock("@/lib/stellar/client", () => ({
  rpc: { getAccount: vi.fn(), simulateTransaction: vi.fn(), getTransaction: vi.fn() },
  submitTransaction: vi.fn(),
  waitForTransaction: vi.fn(),
  networkConfig: { networkPassphrase: "Test SDF Network ; September 2015" },
}));

vi.mock("@/services/invoiceService", () => ({
  prepareCreateInvoice: vi.fn().mockResolvedValue({ metadataCid: "QmMockCid" }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CTEST000000000000000000000000000000000000000000000000000",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CTEST000000000000000000000000000000000000000000000000001",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CTEST000000000000000000000000000000000000000000000000002",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://gateway.pinata.cloud/ipfs",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
  },
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(() => ({
    isConnected: true,
    address: "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE",
    signTransaction: vi.fn().mockImplementation(async (xdr: string) => `${xdr}_signed`),
    isVerified: false,
    checkVerification: vi.fn(() => false),
  })),
}));

vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: vi.fn(() => ({
    execute: vi.fn(),
    status: "idle",
    error: null,
    reset: vi.fn(),
  })),
}));

vi.mock("@/hooks/useTxSimulation", () => ({
  useTxSimulation: vi.fn(() => ({
    simulationDialogProps: { open: false, onOpenChange: vi.fn(), simulation: null },
    onSimulationPreview: vi.fn(),
  })),
}));

vi.mock("@/hooks/usePinataHealth", () => ({
  usePinataHealth: vi.fn(() => ({
    isChecking: false,
    status: "healthy",
    recheck: vi.fn(),
    retryCount: 0,
  })),
}));

vi.mock("@/hooks/useVerifiedAction", () => ({
  useVerifiedAction: vi.fn(() => ({
    executeProtectedAction: vi.fn(),
  })),
}));

vi.mock("@/components/invoice/TxSimulationPreview", () => ({
  TxSimulationPreview: () => null,
}));

vi.mock("@/store", async () => {
  const { create } = await import("zustand");

  const useUIStore = create<any>()((set) => ({
    walletModalOpen: false,
    txState: { status: "idle" },
    setWalletModalOpen: mockSetWalletModalOpen,
    setTxState: (s: any) => set((prev: any) => ({ txState: { ...prev.txState, ...s } })),
    resetTxState: () => set({ txState: { status: "idle" } }),
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
    theme: "dark",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }));

  const useInvoiceStore = create<any>()((set) => ({
    createDraft: { currency: "USDC" },
    setCreateDraft: (draft: any) => set((s: any) => ({ createDraft: { ...s.createDraft, ...draft } })),
    clearCreateDraft: () => set({ createDraft: { currency: "USDC" } }),
    invoices: [],
    filters: { categories: [], jurisdictions: [], riskTiers: [], aprRange: [0, 50], activeOnly: false },
    sort: { sortBy: "apr", sortDir: "desc" },
    searchQuery: "",
    setFilters: vi.fn(),
    setSort: vi.fn(),
    setSearchQuery: vi.fn(),
  }));

  const useTransactionStore = create<any>()(() => ({
    transactions: [],
    addTransaction: vi.fn(),
    removeTransaction: vi.fn(),
    clearHistory: vi.fn(),
  }));

  return {
    useUIStore,
    useInvoiceStore,
    useWalletStore: mockUseWalletStore,
    useTransactionStore,
  };
});

// ── Import SUT after mocks ────────────────────────────────────────────────────

import CreateInvoicePage from "@/app/invoice/create/page";
import { useFeatureFlag } from "@/lib/featureFlags";
import { useInvoiceStore, useUIStore } from "@/store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function setup() {
  const user = userEvent.setup();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <CreateInvoicePage />
    </QueryClientProvider>
  );
  return { user, ...utils };
}

/** Fill all step 0 required fields */
async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText(/invoice number/i), { target: { value: "INV-2024-0001" } });
  fireEvent.blur(screen.getByLabelText(/invoice number/i));
  fireEvent.change(screen.getByLabelText(/debtor company name/i), { target: { value: "Acme Corp Ltd" } });
  fireEvent.blur(screen.getByLabelText(/debtor company name/i));
  fireEvent.change(screen.getByLabelText(/debtor address/i), { target: { value: "123 Business St, Nairobi" } });
  fireEvent.blur(screen.getByLabelText(/debtor address/i));
  fireEvent.change(screen.getByRole("spinbutton", { name: /invoice amount/i }), { target: { value: "50000" } });
  fireEvent.blur(screen.getByRole("spinbutton", { name: /invoice amount/i }));
  fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: futureDate(90) } });
  fireEvent.blur(screen.getByLabelText(/due date/i));
}

/** Fill all step 1 (financing) required fields */
async function fillStep2(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByRole("spinbutton", { name: /discount rate/i }), { target: { value: "5" } });
  fireEvent.blur(screen.getByRole("spinbutton", { name: /discount rate/i }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /minimum investment/i }), { target: { value: "1000" } });
  fireEvent.blur(screen.getByRole("spinbutton", { name: /minimum investment/i }));
  fireEvent.change(screen.getByLabelText(/listing expiry date/i), { target: { value: futureDate(30) } });
  fireEvent.blur(screen.getByLabelText(/listing expiry date/i));
}

/** Navigate through step 0 and step 1 up to the Next click on step 1 */
async function goToStep2Click() {
  const { user } = setup();

  // Step 0 → Step 1
  await fillStep1(user);
  const nextBtn = screen.getByRole("button", { name: /next/i });
  await waitFor(() => expect(nextBtn).not.toBeDisabled());
  fireEvent.click(nextBtn);
  await screen.findByText(/live financing preview/i);

  // Fill step 1 fields
  await fillStep2(user);
  const nextBtn2 = screen.getByRole("button", { name: /next/i });
  await waitFor(() => expect(nextBtn2).not.toBeDisabled());

  return { user, nextBtn2 };
}

beforeEach(() => {
  vi.mocked(useFeatureFlag).mockReturnValue(false);
  mockUseWalletStore.setState({
    addressBook: [],
    address: "GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE",
    isConnected: true,
    isVerified: false,
    kycStatus: "none",
  });
  useInvoiceStore.setState({
    createDraft: { currency: "USDC" },
    invoices: [],
    filters: { categories: [], jurisdictions: [], riskTiers: [], aprRange: [0, 50], activeOnly: false },
    sort: { sortBy: "apr", sortDir: "desc" },
    searchQuery: "",
  });
  useUIStore.setState({ walletModalOpen: false, txState: { status: "idle" }, sidebarOpen: false, theme: "dark" });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. FLAG OFF — unverified user advances normally
// ─────────────────────────────────────────────────────────────────────────────

describe("kyb-mint-gate flag OFF", () => {
  it("allows an unverified user to advance from step 1 to step 2", async () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    mockUseWalletStore.setState({ kycStatus: "none" });

    const { nextBtn2 } = await goToStep2Click();
    fireEvent.click(nextBtn2);

    // Step 2 content (Upload & Review) should appear, no gate screen.
    await screen.findByText("Upload & Review");
    expect(screen.queryByTestId("kyb-gate-screen")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. FLAG ON + kycStatus "none" — gate is shown
// ─────────────────────────────────────────────────────────────────────────────

describe("kyb-mint-gate flag ON — kycStatus: none", () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    mockUseWalletStore.setState({ kycStatus: "none" });
  });

  it("renders KybGateScreen instead of Upload & Review step", async () => {
    const { nextBtn2 } = await goToStep2Click();
    fireEvent.click(nextBtn2);

    await screen.findByTestId("kyb-gate-screen");
    expect(screen.queryByText(/invoice document/i)).not.toBeInTheDocument();
  });

  it("shows the Start Verification CTA button", async () => {
    const { nextBtn2 } = await goToStep2Click();
    fireEvent.click(nextBtn2);

    await screen.findByTestId("kyb-gate-cta");
    expect(screen.getByTestId("kyb-gate-cta")).toHaveTextContent(/start verification/i);
  });

  it("navigating Back from the gate returns to step 1", async () => {
    const { nextBtn2 } = await goToStep2Click();
    fireEvent.click(nextBtn2);

    await screen.findByTestId("kyb-gate-screen");
    fireEvent.click(screen.getByTestId("kyb-gate-back"));

    await screen.findByText(/live financing preview/i);
    expect(screen.queryByTestId("kyb-gate-screen")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FLAG ON + kycStatus "pending" — pending badge is shown
// ─────────────────────────────────────────────────────────────────────────────

describe("kyb-mint-gate flag ON — kycStatus: pending", () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    mockUseWalletStore.setState({ kycStatus: "pending" });
  });

  it("renders KybGateScreen with pending status badge", async () => {
    const { nextBtn2 } = await goToStep2Click();
    fireEvent.click(nextBtn2);

    await screen.findByTestId("kyb-gate-screen");
    expect(screen.getByTestId("kyb-pending-badge")).toBeInTheDocument();
  });

  it("does not show a Start Verification CTA when pending", async () => {
    const { nextBtn2 } = await goToStep2Click();
    fireEvent.click(nextBtn2);

    await screen.findByTestId("kyb-gate-screen");
    expect(screen.queryByTestId("kyb-gate-cta")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. FLAG ON + kycStatus "rejected" — re-verify CTA is shown
// ─────────────────────────────────────────────────────────────────────────────

describe("kyb-mint-gate flag ON — kycStatus: rejected", () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    mockUseWalletStore.setState({ kycStatus: "rejected" });
  });

  it("renders KybGateScreen with re-verify CTA", async () => {
    const { nextBtn2 } = await goToStep2Click();
    fireEvent.click(nextBtn2);

    await screen.findByTestId("kyb-gate-screen");
    expect(screen.getByTestId("kyb-gate-cta")).toHaveTextContent(/re-verify/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. FLAG ON + kycStatus "verified" — no gate, wizard advances normally
// ─────────────────────────────────────────────────────────────────────────────

describe("kyb-mint-gate flag ON — kycStatus: verified", () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    mockUseWalletStore.setState({ kycStatus: "verified" });
  });

  it("advances to Upload & Review without showing the gate", async () => {
    const { nextBtn2 } = await goToStep2Click();
    fireEvent.click(nextBtn2);

    await screen.findByText("Upload & Review");
    expect(screen.queryByTestId("kyb-gate-screen")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Polling auto-advance — "pending" → "verified" dismisses gate
// ─────────────────────────────────────────────────────────────────────────────

describe("kyb-mint-gate flag ON — polling auto-advance", () => {
  it("auto-advances to step 2 when kycStatus transitions to verified during polling", async () => {
    vi.mocked(useFeatureFlag).mockReturnValue(true);
    mockUseWalletStore.setState({ kycStatus: "pending" });

    const { nextBtn2 } = await goToStep2Click();
    fireEvent.click(nextBtn2);

    // Gate screen is shown while status is pending
    await screen.findByTestId("kyb-gate-screen");

    vi.useFakeTimers();
    try {
      // Simulate the status being updated (e.g. Synaps modal sets it)
      act(() => {
        mockUseWalletStore.setState({ kycStatus: "verified" });
      });

      // Advance timer past poll interval (4 seconds)
      act(() => {
        vi.advanceTimersByTime(4500);
      });

      // Gate should be gone
      expect(screen.queryByTestId("kyb-gate-screen")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
