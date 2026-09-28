import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import {
  ErrorTransactionToast,
  PendingTransactionToast,
  SuccessTransactionToast,
  WarningTransactionToast,
} from "./TransactionToasts";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import arMessages from "@/messages/ar.json";
import ptBRMessages from "@/messages/pt-BR.json";

const VALID_HASH = "a".repeat(64);
const allMessages = {
  en: enMessages,
  es: esMessages,
  ar: arMessages,
  "pt-BR": ptBRMessages,
};

const meta: Meta = {
  title: "Transactions/TransactionToasts",
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <LocaleProvider allMessages={allMessages}>
        <Story />
      </LocaleProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  render: () => <PendingTransactionToast message="Submitting invoice funding transaction" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeInTheDocument();
    await expect(
      canvas.getByText("Submitting invoice funding transaction"),
    ).toBeInTheDocument();
  },
};

export const Success: Story = {
  render: () => (
    <SuccessTransactionToast
      message="Invoice repayment confirmed"
      txHash={VALID_HASH}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link")).toHaveAttribute(
      "href",
      expect.stringContaining(VALID_HASH),
    );
  },
};

export const ErrorWithRetry: Story = {
  render: () => (
    <ErrorTransactionToast
      message="Funding transaction failed"
      details="The wallet signature expired before submission."
      onRetry={fn()}
      toastId="storybook-error-toast"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /retry/i }));
    await expect(
      canvas.getByText("Funding transaction failed"),
    ).toBeInTheDocument();
  },
};

export const Warning: Story = {
  render: () => (
    <WarningTransactionToast
      message="Explorer confirmation is delayed"
      details="The transaction is submitted and still awaiting a ledger close."
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeInTheDocument();
    await expect(
      canvas.getByText("Explorer confirmation is delayed"),
    ).toBeInTheDocument();
  },
};
