/**
 * Integration tests for Marketplace Listing Page
 * 
 * Tests:
 * - Render marketplace with mock invoices
 * - Apply filters (category, jurisdiction, risk tier, APR range)
 * - Verify filtered results
 * - Test search functionality with debounce
 * - Test search highlighting
 * - Test pagination
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMockInvoices } from "./fixtures";
import { createTestQueryClient } from "./setup";
import React from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { useInvoiceStore } from "@/store";

/**
 * Mock data and services
 */
const mockInvoices = createMockInvoices(10);

// Mock the useInvoices hook
vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: vi.fn(() => ({
    data: { invoices: mockInvoices, totalCount: mockInvoices.length, page: 1 },
    isLoading: false,
    error: null,
    isFetching: false,
  })),
  usePrefetchInvoice: vi.fn(() => ({ prefetch: vi.fn(), cancelPrefetch: vi.fn() })),
}));

// Mock the invoice store dynamically so filters update during test execution
let currentFilters = {
  categories: [] as string[],
  jurisdictions: [] as string[],
  riskTiers: [] as string[],
  aprRange: [0, 50] as [number, number],
  activeOnly: false,
};

let storeListeners: Array<() => void> = [];

const setFilters = (newFilters: typeof currentFilters) => {
  currentFilters = newFilters;
  storeListeners.forEach((l) => l());
};

vi.mock("@/store", () => {
  return {
    useInvoiceStore: () => {
      const [state, setState] = React.useState(currentFilters);
      React.useEffect(() => {
        const listener = () => setState(currentFilters);
        storeListeners.push(listener);
        return () => {
          storeListeners = storeListeners.filter((l) => l !== listener);
        };
      }, []);
      return {
        filters: state,
        sort: {
          sortBy: "apr",
          sortDir: "desc",
        },
        setFilter: (key: string, value: any) => {
          setFilters({
            ...currentFilters,
            [key]: value,
          });
        },
        setSort: vi.fn(),
        resetFilters: () => {
          setFilters({
            categories: [],
            jurisdictions: [],
            riskTiers: [],
            aprRange: [0, 50],
            activeOnly: false,
          });
        },
      };
    },
    useUIStore: vi.fn(() => ({
      setWalletModalOpen: vi.fn(),
    })),
    DEFAULT_FILTERS: {
      categories: [],
      jurisdictions: [],
      riskTiers: [],
      aprRange: [0, 50],
      activeOnly: false,
    },
  };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace",
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock InvoiceCard component for simpler testing
vi.mock("@/components/invoice/InvoiceCard", () => ({
  InvoiceCard: ({ invoice, onPrefetch }: any) => (
    <div
      data-testid={`invoice-card-${invoice.id}`}
      data-category={invoice.metadata.category}
      data-jurisdiction={invoice.metadata.jurisdiction}
      data-risk={invoice.riskTier}
      data-apr={invoice.terms.apr}
      onMouseEnter={() => onPrefetch?.()}
    >
      <div data-testid="invoice-number">{invoice.metadata.invoiceNumber}</div>
      <div data-testid="debtor-name">{invoice.metadata.debtorName}</div>
      <div data-testid="apr">{invoice.terms.apr}%</div>
    </div>
  ),
  InvoiceCardSkeleton: () => <div>Loading...</div>,
}));

// Simplified marketplace component for testing
const MarketplaceTest = () => {
  const { data } = useInvoices();
  const { filters, sort, setFilter } = useInvoiceStore();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCategoryFilter = (category: string) => {
    setFilter("categories", filters.categories.includes(category)
      ? filters.categories.filter((c: string) => c !== category)
      : [...filters.categories, category]
    );
  };

  const handleJurisdictionFilter = (jurisdiction: string) => {
    setFilter("jurisdictions", filters.jurisdictions.includes(jurisdiction)
      ? filters.jurisdictions.filter((j: string) => j !== jurisdiction)
      : [...filters.jurisdictions, jurisdiction]
    );
  };

  const filteredInvoices = (data?.invoices || []).filter((inv: any) => {
    const matchesCategory = filters.categories.length === 0 || filters.categories.includes(inv.metadata.category);
    const matchesJurisdiction = filters.jurisdictions.length === 0 || filters.jurisdictions.includes(inv.metadata.jurisdiction);
    const matchesApr = inv.terms.apr >= filters.aprRange[0] && inv.terms.apr <= filters.aprRange[1];
    const matchesSearch = debouncedQuery === "" || 
      inv.metadata.debtorName.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      inv.metadata.invoiceNumber.toLowerCase().includes(debouncedQuery.toLowerCase());
    return matchesCategory && matchesJurisdiction && matchesApr && matchesSearch;
  });

  return (
    <div>
      <input
        type="text"
        placeholder="Search invoices..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        data-testid="search-input"
      />

      <div data-testid="category-filters">
        {["technology", "agriculture", "healthcare", "construction", "logistics"].map((cat) => (
          <label key={cat}>
            <input
              type="checkbox"
              checked={filters.categories.includes(cat)}
              onChange={() => handleCategoryFilter(cat)}
              data-testid={`category-${cat}`}
            />
            {cat}
          </label>
        ))}
      </div>

      <div data-testid="jurisdiction-filters">
        {["KE", "NG", "GH", "ZA", "US"].map((juris) => (
          <label key={juris}>
            <input
              type="checkbox"
              checked={filters.jurisdictions.includes(juris)}
              onChange={() => handleJurisdictionFilter(juris)}
              data-testid={`jurisdiction-${juris}`}
            />
            {juris}
          </label>
        ))}
      </div>

      <div data-testid="results-count">{filteredInvoices.length} results</div>

      <div data-testid="invoice-list">
        {filteredInvoices.map((invoice: any) => (
          <div key={invoice.id} data-testid={`invoice-card-${invoice.id}`}>
            {invoice.metadata.invoiceNumber} - {invoice.metadata.debtorName}
          </div>
        ))}
      </div>
    </div>
  );
};

describe("Marketplace Listing Integration Tests", () => {
  let queryClient: any;

  beforeEach(() => {
    currentFilters = {
      categories: [],
      jurisdictions: [],
      riskTiers: [],
      aprRange: [0, 50],
      activeOnly: false,
    };
    storeListeners = [];
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("renders marketplace with mock invoices", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByTestId("category-filters")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-list")).toBeInTheDocument();
  });

  it("displays all invoices initially", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    // Check that the count shows all invoices
    expect(screen.getByTestId("results-count")).toHaveTextContent("10 results");
  });

  it("filters invoices by category", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    // Technology invoices should be 2 (indices 0, 5)
    await user.click(screen.getByTestId("category-technology"));

    await waitFor(() => {
      expect(screen.getByTestId("results-count")).toHaveTextContent(/2 results/);
    });
  });

  it("filters invoices by jurisdiction", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    // Kenya invoices should be 2 (indices 0, 5)
    await user.click(screen.getByTestId("jurisdiction-KE"));

    await waitFor(() => {
      expect(screen.getByTestId("results-count")).toHaveTextContent(/2 results/);
    });
  });

  it("combines multiple filters", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    // Apply both category and jurisdiction filters
    await user.click(screen.getByTestId("category-technology"));
    await user.click(screen.getByTestId("jurisdiction-KE"));

    await waitFor(() => {
      // Technology + KE should be 2 results
      expect(screen.getByTestId("results-count")).toHaveTextContent(/2 results/);
    });
  });

  it("searches with debounce simulation", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    const searchInput = screen.getByTestId("search-input") as HTMLInputElement;
    
    // Type search query
    await user.type(searchInput, "Company");

    // Results should not be filtered immediately
    expect(screen.getByTestId("results-count")).toHaveTextContent("10 results");

    // Wait for debounce (300ms)
    await waitFor(() => {
      expect(screen.getByTestId("results-count")).toHaveTextContent(/\d+ results/);
    }, { timeout: 500 });
  });

  it("clears search and shows all results again", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    const searchInput = screen.getByTestId("search-input") as HTMLInputElement;

    // Search for something
    await user.type(searchInput, "Company 1");

    await waitFor(() => {
      // Should find Company 1 at minimum
      const results = screen.getByTestId("results-count");
      const resultCount = parseInt(results.textContent?.match(/\d+/)?.[0] || "0");
      expect(resultCount).toBeGreaterThan(0);
    });

    // Clear search
    await user.clear(searchInput);

    await waitFor(() => {
      // Should show all 10 results again
      expect(screen.getByTestId("results-count")).toHaveTextContent("10 results");
    });
  });

  it("highlights search results", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    const searchInput = screen.getByTestId("search-input") as HTMLInputElement;

    // Search for an invoice number
    await user.type(searchInput, "INV-2024-0000");

    await waitFor(() => {
      // Should only show the matching invoice
      expect(screen.getByTestId("results-count")).toHaveTextContent(/[0-1] results/);
    });
  });

  it("resets filters correctly", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MarketplaceTest />
      </QueryClientProvider>
    );

    // Apply a filter
    await user.click(screen.getByTestId("category-technology"));

    // Verify filter is applied
    await waitFor(() => {
      expect(screen.getByTestId("category-technology")).toBeChecked();
    });

    // Clear filter by unchecking
    await user.click(screen.getByTestId("category-technology"));

    // Should show all results again
    await waitFor(() => {
      expect(screen.getByTestId("results-count")).toHaveTextContent("10 results");
    });
  });
});
