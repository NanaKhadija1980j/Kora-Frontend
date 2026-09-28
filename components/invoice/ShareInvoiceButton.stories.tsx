import type { Meta, StoryObj } from "@storybook/react";
import { ShareInvoiceButton } from "./ShareInvoiceButton";

const meta: Meta<typeof ShareInvoiceButton> = {
  title: "Invoice/ShareInvoiceButton",
  component: ShareInvoiceButton,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof ShareInvoiceButton>;

export const Default: Story = {
  args: {
    id: "inv-001",
    tokenId: "tok-001",
    invoiceTitle: "INV-2024-001 — Acme Corp",
    summary: "50,000 USDC @ 14.5% APR",
  },
};

export const OutlineVariant: Story = {
  args: {
    id: "inv-001",
    tokenId: "tok-001",
    variant: "outline",
  },
};

export const PrimaryVariant: Story = {
  args: {
    id: "inv-001",
    tokenId: "tok-001",
    variant: "default",
  },
};
