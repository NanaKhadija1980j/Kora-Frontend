import type { Meta, StoryObj } from "@storybook/react";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

const meta: Meta<typeof InvoiceStatusBadge> = {
  title: "Invoice/InvoiceStatusBadge",
  component: InvoiceStatusBadge,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof InvoiceStatusBadge>;

export const Listed: Story = {
  args: {
    status: "listed",
  },
};

export const PartiallyFunded: Story = {
  args: {
    status: "partially_funded",
  },
};

export const FullyFunded: Story = {
  args: {
    status: "fully_funded",
  },
};

export const Repaid: Story = {
  args: {
    status: "repaid",
  },
};

export const Defaulted: Story = {
  args: {
    status: "defaulted",
  },
};

export const Cancelled: Story = {
  args: {
    status: "cancelled",
  },
};
