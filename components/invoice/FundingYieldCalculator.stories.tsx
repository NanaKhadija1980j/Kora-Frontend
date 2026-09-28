import type { Meta, StoryObj } from "@storybook/react";
import { FundingYieldCalculator } from "./FundingYieldCalculator";

const meta: Meta<typeof FundingYieldCalculator> = {
  title: "Invoice/FundingYieldCalculator",
  component: FundingYieldCalculator,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof FundingYieldCalculator>;

export const Default: Story = {
  args: {
    amountInput: "5000",
    apr: 14.5,
    daysToMaturity: 180,
    repaymentDate: "2025-09-30T00:00:00Z",
    currency: "USDC",
  },
};

export const HighYield: Story = {
  args: {
    amountInput: "25000",
    apr: 28.0,
    daysToMaturity: 90,
    repaymentDate: "2025-06-30T00:00:00Z",
    currency: "USDC",
  },
};

export const ZeroInput: Story = {
  args: {
    amountInput: "0",
    apr: 12.0,
    daysToMaturity: 60,
    repaymentDate: "2025-05-30T00:00:00Z",
    currency: "USDC",
  },
};
