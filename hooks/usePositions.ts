"use client";

import { useQuery } from "@tanstack/react-query";
import { getPositions } from "@/lib/stellar/contracts";
import { fetchPositions } from "@/services/invoiceService";
import { env } from "@/lib/env";
import type { InvestorPosition } from "@/types/invoice";

export function usePositions(
  investorAddress?: string,
  opts?: { refetchInterval?: number }
) {
  return useQuery<InvestorPosition[]>({
    queryKey: ["positions", investorAddress],
    queryFn: async () => {
      if (!investorAddress) return [];

      // Prefer service layer so mock mode returns rich invoice metadata
      // (jurisdiction / category / risk tier) for allocation breakdowns.
      if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA) {
        const positions = await fetchPositions(investorAddress);
        return positions.map((p) => ({
          id: p.invoiceId,
          invoiceId: p.invoiceId,
          invoice: p.invoice,
          investedAmount: p.investedAmount,
          expectedReturn: p.expectedReturn,
          yieldEarned: p.yieldEarned ?? Math.max(0, p.expectedReturn - p.investedAmount),
          investedAt: p.investedAt ?? p.invoice.createdAt,
          status: p.status,
        }));
      }

      const positions = await getPositions(investorAddress);
      return positions.map((p) => ({
        id: p.invoiceId,
        invoiceId: p.invoiceId,
        invoice: p.invoice,
        investedAmount: p.investedAmount,
        expectedReturn: p.expectedReturn,
        yieldEarned: p.yieldEarned,
        investedAt: p.investedAt,
        status: p.status,
      }));
    },
    enabled: !!investorAddress,
    staleTime: 30_000,
    refetchInterval: opts?.refetchInterval,
  });
}

export default usePositions;
