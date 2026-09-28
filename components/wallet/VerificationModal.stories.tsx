import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { VerificationModal } from "./VerificationModal";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import arMessages from "@/messages/ar.json";
import ptBRMessages from "@/messages/pt-BR.json";

const allMessages = {
  en: enMessages,
  es: esMessages,
  ar: arMessages,
  "pt-BR": ptBRMessages,
};

const meta: Meta<typeof VerificationModal> = {
  title: "Wallet/VerificationModal",
  component: VerificationModal,
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
  args: {
    isOpen: true,
    onVerify: fn(async () => {}),
    onCancel: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyToVerify: Story = {
  args: {
    actionType: "Mint invoice",
    challengeMessage: "Sign this nonce to verify wallet ownership.",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByText("Sign this nonce to verify wallet ownership."),
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: /sign/i }),
    );

    await expect(args.onVerify).toHaveBeenCalled();
  },
};

export const LoadingState: Story = {
  args: {
    isLoading: true,
    actionType: "Repay invoice",
    challengeMessage: "Sign to continue repayment verification.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: /verifying/i }),
    ).toBeDisabled();
  },
};

export const ErrorState: Story = {
  args: {
    error: "Verification failed. Please unlock your wallet and try again.",
    actionType: "Fund invoice",
    challengeMessage: "Sign to verify before funding.",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /cancel/i }));
    await expect(args.onCancel).toHaveBeenCalled();
  },
};
