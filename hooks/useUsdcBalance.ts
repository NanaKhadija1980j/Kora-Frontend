"use client";

import { useQueryClient } from "@tanstack/react-query";
import { getUSDCBalance } from "@/lib/stellar/client";
import { queryKeys } from "@/lib/queryKeys";
import { env } from "@/lib/env";
import { useAccountBalanceQuery } from "@/hooks/useWalletBalances";

const USE_MOCK = env.NEXT_PUBLIC_ENABLE_MOCK_DATA;

/** Default poll interval while waiting for a faucet mint to settle. */
export const USDC_FAUCET_POLL_INTERVAL_MS = 2_000;

/** Maximum time to wait for the USDC balance to reflect a mint. */
export const USDC_FAUCET_POLL_TIMEOUT_MS = 30_000;

export interface UseUsdcBalanceOptions {
  /**
   * When set, re-fetches the balance on this interval (ms).
   * Pass `false` to disable. Useful while polling after a testnet mint.
   */
  refetchInterval?: number | false;
}

/**
 * Returns `true` when the testnet USDC faucet may be offered in the UI.
 * Mainnet and futurenet never expose the faucet.
 */
export function isTestnetUsdcFaucetEnabled(): boolean {
  return env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet";
}

/**
 * Fetch the live USDC balance for an address (bypasses React Query cache).
 * Returns `0` in mock mode.
 */
export async function fetchUsdcBalance(address: string): Promise<number> {
  if (USE_MOCK) return 999_999;
  return getUSDCBalance(address);
}

export interface PollUsdcBalanceOptions {
  /** Starting balance before the mint (default 0). */
  previousBalance?: number;
  /** Poll interval in ms (default 2000). */
  intervalMs?: number;
  /** Give up after this many ms (default 30000). */
  timeoutMs?: number;
  /** Require balance to increase by at least this much (default any increase). */
  minIncrease?: number;
}

/**
 * Poll Horizon until the USDC balance increases past `previousBalance`,
 * or until the timeout elapses. Always returns the latest known balance.
 */
export async function pollUsdcBalanceAfterMint(
  address: string,
  options: PollUsdcBalanceOptions = {},
): Promise<number> {
  const {
    previousBalance = 0,
    intervalMs = USDC_FAUCET_POLL_INTERVAL_MS,
    timeoutMs = USDC_FAUCET_POLL_TIMEOUT_MS,
    minIncrease = 0,
  } = options;

  if (USE_MOCK) {
    return Math.max(previousBalance + Math.max(minIncrease, 10_000), 999_999);
  }

  const deadline = Date.now() + timeoutMs;
  let latest = previousBalance;

  while (Date.now() < deadline) {
    try {
      latest = await getUSDCBalance(address);
      if (latest >= previousBalance + minIncrease && latest > previousBalance) {
        return latest;
      }
    } catch {
      // Account may still be indexing — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // Final attempt before returning whatever we last saw.
  try {
    latest = await getUSDCBalance(address);
  } catch {
    // keep previous latest
  }
  return latest;
}

/**
 * Returns the wallet's USDC balance as a number.
 * Falls back to a large mock balance when mock mode is on.
 *
 * @deprecated Prefer `useAccountBalance` from `hooks/useAccountBalance` for
 * new code when you need XLM/EURC as well. This hook remains the lightweight
 * USDC-only query used by investor funding / faucet flows.
 */
export function useUsdcBalance(
  address: string | undefined,
  options: UseUsdcBalanceOptions = {},
) {
  const queryClient = useQueryClient();
  const { refetchInterval = false } = options;
  const query = useAccountBalanceQuery(address, {
    refetchInterval,
  });

  return {
    ...query,
    data: query.data ? Number.parseFloat(query.data.usdc ?? "0") : query.data,
    /** Invalidate + refetch the USDC balance query for this address. */
    invalidate: async () => {
      if (!address) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.balances(address),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.usdcBalance(address),
      });
    },
  };
}
