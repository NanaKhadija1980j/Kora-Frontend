import type { Meta, StoryObj } from "@storybook/react";
import { TxSimulationPreview } from "@/components/invoice/TxSimulationPreview";
import type { SimulationPreview } from "@/hooks/useTransaction";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const meta: Meta<typeof TxSimulationPreview> = {
  title: "Invoice/TxSimulationPreview",
  component: TxSimulationPreview,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={en}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TxSimulationPreview>;

const successPreview: SimulationPreview = {
  feeStroops: 125_000,
  feeXlm: 0.0125,
  resourceFee: 125_000,
  cpuInstructions: 2_450_000,
  memoryBytes: 4096,
  readBytes: 2048,
  writeBytes: 1024,
};

const errorPreview: SimulationPreview = {
  feeStroops: 0,
  feeXlm: 0,
  resourceFee: 0,
  cpuInstructions: 0,
  memoryBytes: 0,
  readBytes: 0,
  writeBytes: 0,
  error: "Unauthorized: caller is not the owner",
};

export const Simulating: Story = {
  args: {
    open: true,
    preview: null,
    onProceed: () => undefined,
    onCancel: () => undefined,
  },
};

export const Success: Story = {
  args: {
    open: true,
    preview: successPreview,
    onProceed: () => undefined,
    onCancel: () => undefined,
  },
};

export const SimulationError: Story = {
  args: {
    open: true,
    preview: errorPreview,
    onProceed: () => undefined,
    onCancel: () => undefined,
  },
};
