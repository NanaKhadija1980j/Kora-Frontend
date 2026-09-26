/**
 * Tests for CommandPalette (issue #510 — navigation, wallet, and invoice actions).
 *
 * Covers:
 *  ── Invoice search (issue #213, retained) ───────────────────────────────────
 *  - Filtering invoices by debtor name, invoice number, token ID, and face value
 *  - 300ms debounce before the invoice list is filtered
 *  - Status badge + funded % shown alongside each invoice result
 *  - Selecting an invoice result navigates to /marketplace/[id]
 *  - Keyboard navigation (arrow keys + Enter) selects a result
 *
 *  ── Navigation commands (issue #510) ────────────────────────────────────────
 *  - All PAGE_COMMANDS labels are visible when the palette opens with no query
 *  - Selecting a page command navigates to the correct route
 *
 *  ── Wallet actions (issue #510) ─────────────────────────────────────────────
 *  - "Connect Wallet" shown when disconnected, hidden when connected
 *  - "Disconnect Wallet" shown when connected, hidden when disconnected
 *  - Clicking "Disconnect Wallet" calls disconnect()
 *  - Clicking "Connect Wallet" opens the wallet modal
 *
 *  ── Recent items (issue #510) ────────────────────────────────────────────────
 *  - Recent items stored by pushRecent appear in the Recent section
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "@/components/command/CommandPalette";
import { createMockInvoice } from "@/__tests__/fixtures";
import type { RecentItem } from "@/hooks/useCommandPalette";
import enMessages from "@/messages/en.json";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const ns = namespace ? (enMessages as Record<string, any>)[namespace] : enMessages;
    return (key: string, values?: Record<string, string>) => {
      let str = ns?.[key] ?? key;
      if (values) {
        for (const [k, v] of Object.entries(values)) {
          str = str.replace(`{${k}}`, v);
        }
      }
      return str;
    };
  },
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

let localeSynonyms = [
  "connect wallet",
  "create invoice",
  "disconnect wallet",
  "shortcuts",
  "keyboard shortcuts",
];

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    if (key === "synonyms") return localeSynonyms;
    return key;
  },
}));

let paletteOpen = true;
const setOpenMock = vi.fn((v: boolean) => {
  paletteOpen = v;
});
let recentItems: RecentItem[] = [];
const getRecentMock = vi.fn(() => recentItems);
const pushRecentMock = vi.fn();
const clearRecentMock = vi.fn();

vi.mock("@/hooks/useCommandPalette", () => ({
  useCommandPalette: () => ({
    open: paletteOpen,
    setOpen: setOpenMock,
    getRecent: getRecentMock,
    pushRecent: pushRecentMock,
    clearRecent: clearRecentMock,
  }),
  COMMAND_PALETTE_SHORTCUTS: [],
}));

let walletConnected = true;
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ isConnected: walletConnected }),
}));

const setWalletModalOpenMock = vi.fn();
vi.mock("@/store/uiStore", () => ({
  useUIStore: (selector: (s: { setWalletModalOpen: typeof setWalletModalOpenMock }) => unknown) =>
    selector({ setWalletModalOpen: setWalletModalOpenMock }),
}));

const disconnectMock = vi.fn();
vi.mock("@/store", () => ({
  useWalletStore: (selector: (s: { disconnect: typeof disconnectMock }) => unknown) =>
    selector({ disconnect: disconnectMock }),
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

vi.mock("@/hooks/useFormatters", () => ({
  useFormatters: () => ({
    formatCurrency: (value: number) => String(value),
    formatPercentage: (value: number) => `${value.toFixed(0)}%`,
  }),
}));

vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

// cmdk may call scrollIntoView when moving the highlighted item — not implemented in jsdom.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  paletteOpen = true;
  walletConnected = true;
  recentItems = [];
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function typeQuery(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByLabelText("Command palette search");
  await user.type(input, text);
}

// ── Invoice search tests (issue #213) ──────────────────────────────────────────

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

// ── Navigation commands (issue #510) ──────────────────────────────────────────

describe("CommandPalette — navigation commands", () => {
  const PAGE_LABELS = [
    "Marketplace",
    "Secondary Market",
    "Investor Dashboard",
    "My Invoices",
    "Create Invoice",
    "Transaction History",
    "Analytics",
  ];

  it("renders all primary page command labels when the palette is open with no query", () => {
    render(<CommandPalette />);
    for (const label of PAGE_LABELS) {
      // Some labels (e.g. "Create Invoice") may appear in both Pages and Actions groups
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("navigates to /marketplace when Marketplace is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await user.click(screen.getByText("Marketplace"));
    expect(pushMock).toHaveBeenCalledWith("/marketplace");
    expect(setOpenMock).toHaveBeenCalledWith(false);
  });

  it("navigates to /transactions when Transaction History is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await user.click(screen.getByText("Transaction History"));
    expect(pushMock).toHaveBeenCalledWith("/transactions");
  });

  it("surfaces Secondary Market from search and navigates with Enter", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "secondary");

    expect(screen.getByTestId("nav-page-secondary")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-page-marketplace")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");

    expect(pushMock).toHaveBeenCalledWith("/secondary");
    expect(pushRecentMock).toHaveBeenCalledWith({
      id: "/secondary",
      label: "Secondary Market",
      href: "/secondary",
      type: "page",
    });
  });

  it("navigates to /analytics when Analytics is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await user.click(screen.getByText("Analytics"));
    expect(pushMock).toHaveBeenCalledWith("/analytics");
    expect(pushRecentMock).toHaveBeenCalledWith({
      id: "/analytics",
      label: "Analytics",
      href: "/analytics",
      type: "page",
    });
  });

  it("filters page commands by search query", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "Market");

    // HighlightMatch splits the text into spans with a <mark> around the match,
    // so we use a container query via data-testid instead.
    expect(screen.getByTestId("nav-page-marketplace")).toBeInTheDocument();
    // Analytics page item should not be rendered when query is "Market"
    expect(screen.queryByTestId("nav-page-analytics")).not.toBeInTheDocument();
  });
});

// ── Wallet actions (issue #510) ────────────────────────────────────────────────

describe("CommandPalette — wallet actions (disconnected)", () => {
  beforeEach(() => {
    walletConnected = false;
  });

  it("shows Connect Wallet action when not connected", () => {
    render(<CommandPalette />);
    expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
  });

  it("does not show Disconnect Wallet when not connected", () => {
    render(<CommandPalette />);
    expect(screen.queryByText("Disconnect Wallet")).not.toBeInTheDocument();
  });

  it("clicking Connect Wallet opens the wallet modal and closes the palette", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await user.click(screen.getByText("Connect Wallet"));

    expect(setWalletModalOpenMock).toHaveBeenCalledWith(true);
    expect(setOpenMock).toHaveBeenCalledWith(false);
  });
});

describe("CommandPalette — wallet actions (connected)", () => {
  beforeEach(() => {
    walletConnected = true;
  });

  it("shows Disconnect Wallet action when connected", () => {
    render(<CommandPalette />);
    expect(screen.getByText("Disconnect Wallet")).toBeInTheDocument();
  });

  it("does not show Connect Wallet when already connected", () => {
    render(<CommandPalette />);
    expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
  });

  it("clicking Disconnect Wallet calls disconnect() and closes the palette", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await user.click(screen.getByText("Disconnect Wallet"));

    expect(disconnectMock).toHaveBeenCalledTimes(1);
    expect(setOpenMock).toHaveBeenCalledWith(false);
  });
});

// ── Recent items (issue #510) ──────────────────────────────────────────────────

describe("CommandPalette — recent items", () => {
  it("shows a Recent section when getRecent returns items", () => {
    recentItems = [
      { id: "/marketplace", label: "Marketplace", href: "/marketplace", type: "page" },
    ];
    render(<CommandPalette />);
    // Marketplace appears in both Recent and Pages groups
    expect(screen.getAllByText("Marketplace").length).toBeGreaterThan(0);
    // The "Recent" heading should be in the DOM
    expect(screen.getByText("Recent")).toBeInTheDocument();
  });

  it("does not show a Recent section when there are no recent items", () => {
    recentItems = [];
    render(<CommandPalette />);
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });

  it("clicking a recent item navigates and closes the palette", async () => {
    recentItems = [
      { id: "/analytics", label: "Analytics", href: "/analytics", type: "page" },
    ];
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    // Analytics appears in both Recent and Pages — click the first occurrence
    const analyticsItems = screen.getAllByText("Analytics");
    await user.click(analyticsItems[0]);

    expect(setOpenMock).toHaveBeenCalledWith(false);
  });
});

// ── Shortcuts action (issue #709) ───────────────────────────────────────────

describe("CommandPalette — shortcuts action", () => {
  it("dispatches the global shortcut-modal event and closes the palette", async () => {
    const listener = vi.fn();
    window.addEventListener("kora:open-shortcut-modal", listener);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await user.click(screen.getByText("Shortcuts"));

    expect(listener).toHaveBeenCalledOnce();
    expect(setOpenMock).toHaveBeenCalledWith(false);

    window.removeEventListener("kora:open-shortcut-modal", listener);
  });

  it("surfaces the Shortcuts action when searching", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "shortcut");

    expect(screen.getByTestId("action-shortcuts")).toBeInTheDocument();
  });
});

// ── i18n: localized action synonyms ──────────────────────────────────

describe("CommandPalette — localized action synonyms", () => {
  beforeEach(() => {
    localeSynonyms = [
      "connect wallet",
      "create invoice",
      "disconnect wallet",
      "shortcuts",
      "keyboard shortcuts",
    ];
  });

  afterEach(() => {
    localeSynonyms = [
      "connect wallet",
      "create invoice",
      "disconnect wallet",
      "shortcuts",
      "keyboard shortcuts",
    ];
  });

  it("matches Connect Wallet via Spanish synonym", async () => {
    localeSynonyms = ["conectar billetera", "crear factura", "desconectar billetera", "atajos", "atajos de teclado"];
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "conectar");

    expect(screen.getByTestId("action-connect-wallet")).toBeInTheDocument();
  });

  it("matches Create Invoice via Spanish synonym", async () => {
    localeSynonyms = ["conectar billetera", "crear factura", "desconectar billetera", "atajos", "atajos de teclado"];
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "crear");

    expect(screen.getByTestId("action-create-invoice")).toBeInTheDocument();
  });

  it("matches Disconnect Wallet via Spanish synonym", async () => {
    localeSynonyms = ["conectar billetera", "crear factura", "desconectar billetera", "atajos", "atajos de teclado"];
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "desconectar");

    expect(screen.getByTestId("action-disconnect-wallet")).toBeInTheDocument();
  });

  it("matches Shortcuts via Arabic synonym", async () => {
    localeSynonyms = ["ربط المحفظة", "إنشاء فاتورة", "فصل المحفظة", "اختصارات", "اختصارات لوحة المفاتيح"];
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "اختصارات");

    expect(screen.getByTestId("action-shortcuts")).toBeInTheDocument();
  });

  it("matches Connect Wallet via Portuguese synonym", async () => {
    localeSynonyms = ["conectar carteira", "criar fatura", "desconectar carteira", "atalhos", "atalhos de teclado"];
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "conectar");

    expect(screen.getByTestId("action-connect-wallet")).toBeInTheDocument();
  });

  it("hides actions when query matches no localized synonym", async () => {
    localeSynonyms = ["conectar billetera", "crear factura", "desconectar billetera", "atajos", "atajos de teclado"];
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandPalette />);

    await typeQuery(user, "xyznonexistent");

    expect(screen.queryByTestId("action-connect-wallet")).not.toBeInTheDocument();
  });
});
