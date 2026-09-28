import type { WalletBalance } from "@/types";
import type { AccountBalances } from "@/types/stellar";
import type { WalletAssetConfig } from "@/config/walletAssets";
import { env } from "@/lib/env";
import { getAccountBalances } from "@/lib/stellar/client";

const USE_MOCK = env.NEXT_PUBLIC_ENABLE_MOCK_DATA;

const MOCK_ACCOUNT_BALANCES: AccountBalances = {
  xlm: "10000",
  usdc: "999999",
  otherAssets: [
    {
      code: "EURC",
      issuer: "MOCK_ISSUER",
      balance: "5000",
    },
  ],
};

export async function fetchAccountBalanceSnapshot(
  address: string,
): Promise<AccountBalances> {
  if (USE_MOCK) {
    return MOCK_ACCOUNT_BALANCES;
  }

  return getAccountBalances(address);
}

export function getAssetAmount(
  balances: AccountBalances,
  asset: WalletAssetConfig,
): number {
  if (asset.type === "native") {
    return Number.parseFloat(balances.xlm || "0");
  }

  if (asset.code === "USDC" || asset.symbol === "USDC") {
    return Number.parseFloat(balances.usdc || "0");
  }

  const matchedAsset = balances.otherAssets.find((candidate) => {
    if (candidate.code !== asset.code) {
      return false;
    }

    if (!asset.issuer) {
      return true;
    }

    return candidate.issuer === asset.issuer;
  });

  return Number.parseFloat(matchedAsset?.balance || "0");
}

export function toWalletStoreBalance(
  balances: AccountBalances,
): WalletBalance {
  return {
    xlm: balances.xlm,
    usdc: balances.usdc,
    eurc: String(getAssetAmount(balances, {
      symbol: "EURC",
      type: "credit",
      code: "EURC",
    })),
  };
}

export function toLegacyAccountBalance(balances: AccountBalances) {
  return {
    xlm: Number.parseFloat(balances.xlm || "0"),
    usdc: Number.parseFloat(balances.usdc || "0"),
    eurc: getAssetAmount(balances, {
      symbol: "EURC",
      type: "credit",
      code: "EURC",
    }),
  };
}
