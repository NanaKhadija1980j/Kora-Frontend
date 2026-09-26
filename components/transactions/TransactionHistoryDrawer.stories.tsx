import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, userEvent, within } from "@storybook/test";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { TransactionHistoryDrawer } from "./TransactionHistoryDrawer";
import { useTransactionHistoryStore } from "@/store/transactionHistoryStore";

const sampleTransactions = [
  {
    hash: "mock_pending_001",
    type: "fund_invoice" as const,
    status: "pending" as const,
    amount: "2500.00",
    assetCode: "USDC",
    timestamp: Date.parse("2026-07-20T10:30:00Z"),
    description: "Funding invoice INV-1042",
  },
  {
    hash: "mock_failed_002",
    type: "repay_invoice" as const,
    status: "failed" as const,
    amount: "5000.00",
    assetCode: "USDC",
    timestamp: Date.parse("2026-07-18T08:15:00Z"),
    description: "Repayment attempt for invoice INV-1011",
    error: "Ledger submission timed out",
  },
];

const meta: Meta<typeof TransactionHistoryDrawer> = {
  title: "Transactions/TransactionHistoryDrawer",
  component: TransactionHistoryDrawer,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => {
      useTransactionHistoryStore.setState({
        transactions: sampleTransactions,
      });

      return (
        <NextIntlClientProvider locale="en" messages={en}>
          <QueryClientProvider client={new QueryClient()}>
            <Story />
          </QueryClientProvider>
        </NextIntlClientProvider>
      );
    },
  ],
  args: {
    open: true,
    onOpenChange: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Transactions")).toBeInTheDocument();
    await expect(canvas.getByText("Fund Invoice")).toBeInTheDocument();
  },
};

export const InspectTransactionDetail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /fund invoice/i }));
    await expect(canvas.getByText("Transaction Details")).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: /close transaction details/i }),
    );

    await expect(canvas.getByText("Transactions")).toBeInTheDocument();
  },
};
