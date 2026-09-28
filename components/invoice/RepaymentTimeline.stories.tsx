import type { Meta, StoryObj } from "@storybook/react";
import { RepaymentTimeline } from "./RepaymentTimeline";

const meta: Meta<typeof RepaymentTimeline> = {
  title: "Invoice/RepaymentTimeline",
  component: RepaymentTimeline,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof RepaymentTimeline>;

export const InProgress: Story = {
  args: {
    fundedAt: "2025-01-01T00:00:00Z",
    maturityDate: "2026-12-31T00:00:00Z",
    isRepaid: false,
  },
};

export const FullyRepaid: Story = {
  args: {
    fundedAt: "2024-01-01T00:00:00Z",
    maturityDate: "2024-06-01T00:00:00Z",
    repaidAt: "2024-05-28T00:00:00Z",
    isRepaid: true,
    yieldReceived: "$312.50 USDC",
  },
};

export const Overdue: Story = {
  args: {
    fundedAt: "2024-01-01T00:00:00Z",
    maturityDate: "2024-03-01T00:00:00Z",
    isRepaid: false,
  },
};
