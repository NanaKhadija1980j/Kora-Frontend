import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ChartTooltip from "../ChartTooltip";

describe("ChartTooltip", () => {
  it("renders the formatted value and label when active", () => {
    const { getByText } = render(
      <ChartTooltip active payload={[{ value: 1500, name: "Volume" }]} label="2026-01-01" unit="USDC" />
    );
    expect(getByText("2026-01-01")).toBeTruthy();
    expect(getByText(`$${(1500).toLocaleString()}`)).toBeTruthy();
    expect(getByText("Volume")).toBeTruthy();
  });

  it("renders nothing when inactive", () => {
    const { container } = render(
      <ChartTooltip active={false} payload={[{ value: 10 }]} label="2026-01-01" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for an empty or missing payload", () => {
    expect(render(<ChartTooltip active payload={[]} label="x" />).container.firstChild).toBeNull();
    expect(render(<ChartTooltip active label="x" />).container.firstChild).toBeNull();
  });
});
