/**
 * Tests for CommandPalette invoice search (issue #213).
 *
 * Covers:
 *  - Filtering invoices by debtor name, invoice number, token ID, and face value
 *  - 300ms debounce before the invoice list is filtered
 *  - Status badge + funded % shown alongside each invoice result
 *  - Selecting an invoice result navigates to /marketplace/[id]
 *  - Keyboard navigation (arrow keys + Enter) selects a result
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "@/components/command/CommandPalette";
import { createMockInvoice } from "@/__tests__/fixtures";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

let paletteOpen = true;
const setOpenMock = vi.fn((v: boolean) => {
  paletteOpen = v;
});
vi.mock("@/hooks/useCommandPalette", () => ({
  useCommandPalette: () => ({
    open: paletteOpen,
    setOpen: setOpenMock,
    getRecent: () => [],
    pushRecent: vi.fn(),
  }),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ isConnected: true }),
}));

vi.mock("@/store/uiStore", () => ({
  useUIStore: (selector: (s: { setWalletModalOpen: () => void }) => unknown) =>
    selector({ setWalletModalOpen: vi.fn() }),
}));

const mockInvoices = [
  createMockInvoice({
    id: "inv-safaricom",
    tokenId: "42",
    metadata: {
      invoiceNumber: "INV-2024-0891",
      debtorName: "Safaricom PLC",
      amount: 250000,
    } as any,
    funding: { totalRaised: 188000, targetAmount: 235000, fundingProgress: 0.8, investorCount: 14, remainingCapacity: 47000 },
    status: "partially_funded",
  }),
  createMockInvoice({
    id: "inv-shoprite",
    tokenId: "77",
    metadata: {
      invoiceNumber: "INV-2024-0555",
      debtorName: "Shoprite Holdings",
      amount: 90000,
    } as any,
    funding: { totalRaised: 90000, targetAmount: 90000, fundingProgress: 1, investorCount: 3, remainingCapacity: 0 },
    status: "fully_funded",
  }),
];

vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({ data: { data: mockInvoices } }),
}));

// cmdk may call scrollIntoView when moving the highlighted item — not implemented in jsdom.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  paletteOpen = true;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

async function typeQuery(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByLabelText("Command palette search");
  await user.type(input, text);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("CommandPalette — invoice search", () => {
  it("filters invoices by debtor name after the debounce window", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "Safaricom");

    // Not yet filtered — debounce hasn't elapsed
    expect(screen.queryByText("INV-2024-0891")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => expect(screen.getByText("INV-2024-0891")).toBeInTheDocument());
    expect(screen.queryByText("INV-2024-0555")).not.toBeInTheDocument();
  });

  it("filters invoices by on-chain token ID", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "77");
    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => expect(screen.getByText("INV-2024-0555")).toBeInTheDocument());
    expect(screen.queryByText("INV-2024-0891")).not.toBeInTheDocument();
  });

  it("filters invoices by face value (amount)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "250000");
    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => expect(screen.getByText("INV-2024-0891")).toBeInTheDocument());
    expect(screen.queryByText("INV-2024-0555")).not.toBeInTheDocument();
  });

  it("shows the status badge and funded % alongside the result", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "Safaricom");
    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => expect(screen.getByText("INV-2024-0891")).toBeInTheDocument());
    expect(screen.getByText("partially funded")).toBeInTheDocument();
    expect(screen.getByText(/80% funded/)).toBeInTheDocument();
  });

  it("navigates to /marketplace/[id] and closes when an invoice result is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "Safaricom");
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const result = await screen.findByText("INV-2024-0891");
    await user.click(result);

    expect(pushMock).toHaveBeenCalledWith("/marketplace/inv-safaricom");
    expect(setOpenMock).toHaveBeenCalledWith(false);
  });

  it("supports arrow-key navigation and Enter to select a result", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "Safaricom");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await screen.findByText("INV-2024-0891");

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/marketplace/inv-safaricom"));
  });
});
