"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccountBalances } from "@/lib/stellar/client";
import { env } from "@/lib/env";

const USE_MOCK = env.NEXT_PUBLIC_ENABLE_MOCK_DATA;

/** Auto-refresh interval in milliseconds (60 seconds). */
const AUTO_REFRESH_INTERVAL = 60_000;

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

  const query = useQuery({
    queryKey: ["account-balance", address],
    enabled: !!address,
    staleTime: 30_000,
    queryFn: async (): Promise<AccountBalance> => {
      if (USE_MOCK || !address) {
        return { usdc: 999_999, xlm: 10_000, eurc: 5_000 };
      }
      const raw = await getAccountBalances(address);
      const eurcAsset = raw.otherAssets.find((a) => a.code === "EURC");
      return {
        usdc: parseFloat(raw.usdc),
        xlm: parseFloat(raw.xlm),
        eurc: eurcAsset ? parseFloat(eurcAsset.balance) : 0,
      };
    },
  });

  // Auto-refresh every 60s, only when the tab is visible
  useEffect(() => {
    if (!address) return;

    const scheduleRefresh = () => {
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          queryClient.invalidateQueries({ queryKey: ["account-balance", address] });
        }
      }, AUTO_REFRESH_INTERVAL);
    };

    scheduleRefresh();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Immediately refresh when tab becomes visible again
        queryClient.invalidateQueries({ queryKey: ["account-balance", address] });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [address, queryClient]);

  return {
    balance: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
