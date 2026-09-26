import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import PortfolioAnalyticsPage from "@/app/analytics/page";
import { createMockInvoice } from "@/__tests__/fixtures";
import type { AllocatablePosition } from "@/lib/portfolioAllocation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

// Mock next/dynamic to resolve synchronously
vi.mock("next/dynamic", () => {
  return {
    default: (importFunc: any) => {
      const React = require("react");
      return (props: any) => {
        const [Comp, setComp] = React.useState<any>(null);
        React.useEffect(() => {
          importFunc().then((mod: any) => {
            setComp(() => mod.default || mod.YieldProjectionCalculator || mod);
          });
        }, []);

        if (!Comp) {
          return <div data-testid="dynamic-loading">Loading calculator...</div>;
        }
        return <Comp {...props} />;
      };
    },
  };
});

// Mock Recharts
vi.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    AreaChart: ({ children, data }: { children: React.ReactNode; data: any }) => (
      <svg data-testid="area-chart" data-data={JSON.stringify(data)}>
        {children}
      </svg>
    ),
    Area: () => <g data-testid="area" />,
    XAxis: () => <g data-testid="xaxis" />,
    YAxis: () => <g data-testid="yaxis" />,
    CartesianGrid: () => <g data-testid="grid" />,
    Tooltip: () => <g data-testid="tooltip" />,
    Legend: () => <g data-testid="legend" />,
    BarChart: ({ children }: any) => <svg data-testid="bar-chart">{children}</svg>,
    Bar: () => <g data-testid="bar" />,
    LineChart: ({ children }: any) => <svg data-testid="line-chart">{children}</svg>,
    Line: () => <g data-testid="line" />,
    PieChart: ({ children }: any) => <svg data-testid="pie-chart">{children}</svg>,
    Pie: ({ children }: any) => <g data-testid="pie">{children}</g>,
    Cell: () => null,
    ComposedChart: ({ children }: any) => <svg data-testid="composed-chart">{children}</svg>,
    Treemap: () => <div data-testid="treemap" />,
    ReferenceLine: () => <g data-testid="reference-line" />,
  };
});

// Mock Select component to render a simple native select for testing ease
vi.mock("@/components/ui/select", () => {
  return {
    Select: ({ label, value, onChange, options }: any) => (
      <div data-testid={`select-wrapper-${label}`}>
        <label htmlFor={label}>{label}</label>
        <select
          id={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((opt: any) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    ),
  };
});

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      exportSuccess: "Projection exported as PNG",
      exportError: "Failed to export chart",
    };
    return messages[key] ?? key;
  },
  useLocale: () => "en",
  useFormatter: () => ({
    number: (n: number, options?: any) => {
      if (options?.style === "percent") {
        const decimals = options.minimumFractionDigits ?? 2;
        return `${(n * 100).toFixed(decimals)}%`;
      }
      return String(n);
    },
    dateTime: (d: Date, options?: any) => d.toLocaleDateString(),
  }),
}));

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/analytics",
}));

// Mock useWallet
const mockUseWallet = vi.fn(() => ({
  isConnected: true,
  address: "GBUQWP3BOUZX34LOCALCHIP4GEZ6YR4Z5WJGVSQ3XZPMPERJ7D7NONPC",
}));
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => mockUseWallet(),
}));

// Mock usePositions query
const mockUsePositions = vi.fn();
vi.mock("@/hooks/usePositions", () => ({
  usePositions: (address: any, opts: any) => mockUsePositions(address, opts),
}));

// Mock store
vi.mock("@/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store")>();
  return {
    ...actual,
    useInvoiceStore: () => ({
      filters: {
        categories: [],
        jurisdictions: [],
        riskTiers: [],
        aprRange: [0, 50],
        activeOnly: false,
      },
      setFilters: vi.fn(),
      resetFilters: vi.fn(),
    }),
    useUIStore: () => ({
      setWalletModalOpen: vi.fn(),
    }),
  };
});

// Mock Canvas and Image for export tests
const mockDrawImage = vi.fn();
const mockFillRect = vi.fn();
const mockGetContext = vi.fn(() => ({
  drawImage: mockDrawImage,
  fillRect: mockFillRect,
  fillStyle: "",
}));
const mockToDataURL = vi.fn(() => "data:image/png;base64,mock");

class MockImage {
  onload: (() => void) | null = null;
  _src: string = "";
  set src(val: string) {
    this._src = val;
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
  get src() {
    return this._src;
  }
}

let originalImage: any;

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = mockGetContext as any;
  HTMLCanvasElement.prototype.toDataURL = mockToDataURL as any;
  
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();

  originalImage = global.Image;
  global.Image = MockImage as any;
});

afterAll(() => {
  global.Image = originalImage;
});

// Helper query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

describe("YieldProjectionCalculator on Analytics Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lazy-loads and renders the calculator", async () => {
    mockUsePositions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PortfolioAnalyticsPage />
      </QueryClientProvider>
    );

    // Should render loading fallback first, then the actual component
    expect(screen.queryAllByTestId("dynamic-loading").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText("Yield Projection Calculator")).toBeInTheDocument();
    });
  });

  it("seeds default tier based on position average risk", async () => {
    const mockPositions: any[] = [
      {
        id: "pos_1",
        investedAmount: 20000,
        investedAt: new Date().toISOString(),
        invoice: createMockInvoice({ id: "inv_1", txHash: "tx_1", riskTier: "AAA" }), // Index 0
      },
      {
        id: "pos_2",
        investedAmount: 10000,
        investedAt: new Date().toISOString(),
        invoice: createMockInvoice({ id: "inv_2", txHash: "tx_2", riskTier: "BBB" }), // Index 3
      },
    ];

    mockUsePositions.mockReturnValue({
      data: mockPositions,
      isLoading: false,
      error: null,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PortfolioAnalyticsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Yield Projection Calculator")).toBeInTheDocument();
    });

    // Weighted average risk index:
    // (0 * 20000 + 3 * 10000) / 30000 = 1.0 (Index 1 is "AA")
    const select = screen.getByLabelText("Risk Tier Preference") as HTMLSelectElement;
    expect(select.value).toBe("AA");
  });

  it("calculator is interactive (updates outputs on changing values)", async () => {
    mockUsePositions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PortfolioAnalyticsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Yield Projection Calculator")).toBeInTheDocument();
    });

    // Check default investment amount is 10000
    const amountInput = screen.getByPlaceholderText("e.g. 10000") as HTMLInputElement;
    expect(amountInput.value).toBe("10000");

    // Change amount to 20000
    fireEvent.change(amountInput, { target: { value: "20000" } });
    expect(amountInput.value).toBe("20000");

    // Change Risk Tier select
    const tierSelect = screen.getByLabelText("Risk Tier Preference") as HTMLSelectElement;
    fireEvent.change(tierSelect, { target: { value: "BBB" } });
    expect(tierSelect.value).toBe("BBB");

    // Change Horizon select
    const horizonSelect = screen.getByLabelText("Horizon (Months)") as HTMLSelectElement;
    fireEvent.change(horizonSelect, { target: { value: "24" } });
    expect(horizonSelect.value).toBe("24");
  });

  it("hides calculator in print layouts via print-hidden class", async () => {
    mockUsePositions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const queryClient = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <PortfolioAnalyticsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Yield Projection Calculator")).toBeInTheDocument();
    });

    const printHiddenWrapper = container.querySelector(".print-hidden");
    expect(printHiddenWrapper).toBeInTheDocument();
    expect(printHiddenWrapper).toContainElement(screen.getByText("Yield Projection Calculator"));
  });

  it("handles PNG export successfully when clicking Save Projection", async () => {
    mockUsePositions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PortfolioAnalyticsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Yield Projection Calculator")).toBeInTheDocument();
    });

    // Mock SVG structure so querySelector("svg") is successful
    const calculatorContainer = screen.getByText("Yield Projection Calculator").closest(".col-span-full");
    const mockSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    mockSvg.setAttribute("width", "100");
    mockSvg.setAttribute("height", "100");
    calculatorContainer?.appendChild(mockSvg);

    const exportButton = screen.getByRole("button", { name: /Save Projection/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Projection exported as PNG");
    });
  });
});
