/**
 * PortfolioDonut — live allocation breakdown UI tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { PortfolioDonut } from "@/components/dashboard/PortfolioDonut";
import { createMockInvoice } from "@/__tests__/fixtures";
import type { AllocatablePosition } from "@/lib/portfolioAllocation";

vi.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    PieChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="pie-chart">{children}</div>
    ),
    Pie: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="pie">{children}</div>
    ),
    Cell: () => null,
    Tooltip: () => null,
    Sector: () => null,
  };
});

function render(ui: React.ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={en}>
        {children}
      </NextIntlClientProvider>
    ),
  });
}

const positions: AllocatablePosition[] = [
  {
    investedAmount: 15000,
    invoice: createMockInvoice({
      riskTier: "AAA",
      metadata: { jurisdiction: "KE", category: "technology" } as any,
    }),
  },
  {
    investedAmount: 25000,
    invoice: createMockInvoice({
      riskTier: "A",
      metadata: { jurisdiction: "NG", category: "healthcare" } as any,
    }),
  },
];

describe("PortfolioDonut", () => {
  const onSegmentClick = vi.fn();

  beforeEach(() => {
    onSegmentClick.mockReset();
  });

  it("renders three breakdown dimensions from live positions", () => {
    render(
      <PortfolioDonut
        positions={positions}
        activeFilter={null}
        onSegmentClick={onSegmentClick}
      />
    );
    expect(screen.getByText("By Risk Tier")).toBeInTheDocument();
    expect(screen.getByText("By Jurisdiction")).toBeInTheDocument();
    expect(screen.getByText("By Category")).toBeInTheDocument();
    expect(screen.getByText("Portfolio Composition")).toBeInTheDocument();
  });

  it("shows empty state when there are no positions", () => {
    render(
      <PortfolioDonut
        positions={[]}
        activeFilter={null}
        onSegmentClick={onSegmentClick}
      />
    );
    expect(screen.getByText("No portfolio data yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Fund invoices on the marketplace/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("By Risk Tier")).not.toBeInTheDocument();
  });

  it("calls onSegmentClick when a legend item is clicked", () => {
    render(
      <PortfolioDonut
        positions={positions}
        activeFilter={null}
        onSegmentClick={onSegmentClick}
      />
    );
    const keButtons = screen.getAllByRole("button", {
      name: /Browse marketplace filtered by KE/i,
    });
    fireEvent.click(keButtons[0]);
    expect(onSegmentClick).toHaveBeenCalledWith({
      dimension: "jurisdiction",
      value: "KE",
    });
  });

  it("toggles filter off when the active legend item is clicked again", () => {
    render(
      <PortfolioDonut
        positions={positions}
        activeFilter={{ dimension: "riskTier", value: "AAA" }}
        onSegmentClick={onSegmentClick}
      />
    );
    const aaaButtons = screen.getAllByRole("button", {
      name: /Browse marketplace filtered by AAA/i,
    });
    fireEvent.click(aaaButtons[0]);
    expect(onSegmentClick).toHaveBeenCalledWith(null);
  });

  it("shows active filter badge that can be cleared", () => {
    render(
      <PortfolioDonut
        positions={positions}
        activeFilter={{ dimension: "category", value: "technology" }}
        onSegmentClick={onSegmentClick}
      />
    );
    expect(screen.getByText(/Filtering marketplace by/i)).toBeInTheDocument();
    expect(screen.getByText("technology")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Clear filter/i }));
    expect(onSegmentClick).toHaveBeenCalledWith(null);
  });
});
