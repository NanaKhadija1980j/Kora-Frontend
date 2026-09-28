import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { WalletBalance } from "./WalletBalance";
import { useWalletStore } from "@/store";

function WalletBalanceStory({
  xlm,
}: {
  xlm: string | null;
}) {
  useWalletStore.setState({
    balance: xlm === null ? null : { xlm, usdc: "0", eurc: "0" },
  });

  return <WalletBalance />;
}

const meta: Meta<typeof WalletBalanceStory> = {
  title: "Wallet/WalletBalance",
  component: WalletBalanceStory,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ConnectedBalance: Story = {
  args: {
    xlm: "42.13579",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("42.14")).toBeInTheDocument();
    await expect(canvas.getByText("XLM")).toBeInTheDocument();
  },
};

export const NoBalanceYet: Story = {
  args: {
    xlm: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("XLM")).toBeNull();
  },
};
