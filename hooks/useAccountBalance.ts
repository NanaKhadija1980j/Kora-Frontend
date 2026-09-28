"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { toLegacyAccountBalance } from "@/lib/walletBalances";
import { useAccountBalanceQuery } from "@/hooks/useWalletBalances";

/** Auto-refresh interval in milliseconds (60 seconds). */
export const AUTO_REFRESH_INTERVAL = 60_000;

export interface AccountBalance {
  usdc: number;
  xlm: number;
  eurc: number;
}

/**
 * Fetches and caches the full account balance for a given Stellar address.
 *
 * Features:
 * - Returns USDC, XLM, and EURC balances as numbers
 * - Auto-refreshes every 60 seconds while the tab is visible
 * - Exposes a `refetch` function for manual refresh
 * - Falls back to a large mock balance when mock mode is enabled
 */
export function useAccountBalance(address: string | undefined) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const query = useAccountBalanceQuery(address);

  // Auto-refresh every 60s, only when the tab is visible
  useEffect(() => {
    if (!address) return;

    const scheduleRefresh = () => {
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          queryClient.invalidateQueries({
            queryKey: queryKeys.account.balances(address),
          });
        }
      }, AUTO_REFRESH_INTERVAL);
    };

    scheduleRefresh();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Immediately refresh when tab becomes visible again
        queryClient.invalidateQueries({
          queryKey: queryKeys.account.balances(address),
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [address, queryClient]);

  return {
    balance: query.data ? toLegacyAccountBalance(query.data) : null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
