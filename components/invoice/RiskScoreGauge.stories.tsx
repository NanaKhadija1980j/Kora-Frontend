import type { Meta, StoryObj } from "@storybook/react";
import { RiskScoreGauge } from "./RiskScoreGauge";

const sampleFactors = [
  { key: "debtor_credit", label: "Debtor Credit Rating", score: 85 },
  { key: "tenor_length", label: "Tenor & Duration Risk", score: 70 },
  { key: "industry", label: "Industry Stability", score: 90 },
];

const sampleTrend = [75, 78, 80, 82, 85];

const meta: Meta<typeof RiskScoreGauge> = {
  title: "Invoice/RiskScoreGauge",
  component: RiskScoreGauge,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof RiskScoreGauge>;

export const LowRiskAAA: Story = {
  args: {
    score: 20,
    tier: "AAA",
    factors: sampleFactors,
    trend: [15, 18, 20],
  },
};

export const MediumRiskBBB: Story = {
  args: {
    score: 55,
    tier: "BBB",
    factors: sampleFactors,
    trend: [50, 52, 55],
  },
};

export const HighRiskC: Story = {
  args: {
    score: 85,
    tier: "C",
    factors: sampleFactors,
    trend: [75, 80, 85],
  },
};
