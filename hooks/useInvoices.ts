"use client";

import { useEffect, useRef } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useInvoiceStore } from "@/store/invoiceStore";
import {
  fetchInvoices,
  fetchInvoiceById,
  fetchInvoicesByOwner,
  fetchInvestorPositions,
  fetchBatchInvoicesByTokenIds,
  prepareCreateInvoice,
  prepareFundInvoice,
  prepareUpdateInvoiceStatus,
} from "@/services/invoiceService";
import type { CreateInvoiceFormData, InvoiceStatus, MarketplaceSortKey } from "@/types";

// Re-export marketplace prefetch helpers for existing import sites.
export {
  usePrefetchInvoice,
  PREFETCH_DELAY_MS,
  MAX_CONCURRENT_PREFETCHES,
} from "./usePrefetchInvoice";

const STALE_30S = 30_000;
const GC_5MIN = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 30_000;

const SORT_KEY_MAP: Record<string, MarketplaceSortKey> = {
  apr: "apr",
  amount: "amount",
  dueDate: "duration",
  duration: "duration",
  due: "duration",
  listed: "createdAt",
  newest: "createdAt",
  createdAt: "createdAt",
};

function resolveMarketplaceSort(sortBy: string): {
  key: MarketplaceSortKey;
  direction: "asc" | "desc";
} {
  const rawKey = sortBy?.split("_")[0] ?? "apr";
  const key = SORT_KEY_MAP[rawKey] ?? "apr";
  // due_soonest / newest style keys
  if (sortBy === "due_soonest") return { key: "duration", direction: "asc" };
  if (sortBy === "due_latest") return { key: "duration", direction: "desc" };
  if (sortBy === "newest") return { key: "createdAt", direction: "desc" };
  const direction = sortBy?.endsWith("asc") ? "asc" : "desc";
  return { key, direction };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export function useInvoices(pageOrOpts?: number | { refetchInterval?: number }, opts?: { refetchInterval?: number }) {
  const page = typeof pageOrOpts === "number" ? pageOrOpts : 1;
  const refetchInterval = typeof pageOrOpts === "object" ? pageOrOpts?.refetchInterval : opts?.refetchInterval;
  const { filters, sort } = useInvoiceStore();
  return useQuery({
    queryKey: queryKeys.invoices.list(filters, sort, page),
    queryFn: () =>
      fetchInvoices(
        filters,
        { key: SORT_KEY_MAP[sort.sortBy] ?? "apr", direction: sort.sortDir },
        page
      ),
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "hidden"
        ? false
        : 15_000,
    refetchIntervalInBackground: false,
  });
}

/** Default page size for marketplace infinite scroll. */
export const MARKETPLACE_PAGE_SIZE = 12;

/**
 * Cursor/page-based infinite invoice list for the marketplace.
 * Initial load fetches page 1 only; call fetchNextPage as the sentinel intersects.
 * Filter/sort changes reset pagination via the query key.
 */
export function useInfiniteInvoices(options?: {
  pageSize?: number;
  enabled?: boolean;
}) {
  const pageSize = options?.pageSize ?? MARKETPLACE_PAGE_SIZE;
  const enabled = options?.enabled ?? true;
  const filters = useInvoiceStore((s) => s.filters);
  const sortBy = useInvoiceStore((s) => s.sortBy);

  return useInfiniteQuery({
    queryKey: queryKeys.invoices.infinite(filters, sortBy, pageSize),
    queryFn: ({ pageParam }) =>
      fetchInvoices(
        {
          categories: filters.categories,
          jurisdictions: filters.jurisdictions,
          riskTiers: filters.riskTiers,
          aprRange: filters.aprRange,
          activeOnly: filters.activeOnly,
        },
        resolveMarketplaceSort(sortBy),
        pageParam,
        pageSize
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
  });
}

// ─── Detail ───────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(["listed", "partially_funded"]);

export function useInvoice(id: string, walletAddress?: string) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: () => fetchInvoiceById(id, walletAddress),
    enabled: !!id,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
      const status = query.state.data?.status;
      if (!status || !ACTIVE_STATUSES.has(status)) return false;
      if ((query.state.data?.funding.fundingProgress ?? 0) >= 1) return false;
      return ACTIVE_STATUSES.has(status) ? 15_000 : 60_000;
    },
    refetchIntervalInBackground: false,
  });
}

// ─── SME invoices ─────────────────────────────────────────────────────────────

export function useSMEInvoices(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoices.byOwner(address ?? ""),
    queryFn: () => fetchInvoicesByOwner(address!),
    enabled: !!address,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
    // Visibility-based polling: refetch every 30s only when the tab is visible
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "hidden"
        ? false
        : POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

// ─── Batch polling ────────────────────────────────────────────────────────────

/**
 * Batch-fetch and poll a set of invoices by tokenId.
 *
 * - Batches calls in chunks of 20 (enforced in the service layer).
 * - Polling runs every 30 s, paused when the page is hidden (Page Visibility API)
 *   OR when the sentinel element is not in the viewport (Intersection Observer).
 * - In mock mode the service returns from MOCK_INVOICES — no RPC calls are made.
 * - Results are merged into invoiceStore.invoicesByTokenId keyed by tokenId.
 *
 * @param tokenIds        Array of on-chain tokenId strings to watch.
 * @param walletAddress   Used as fee-source for read simulations (live mode only).
 * @param sentinelRef     Optional ref to an element; polling pauses when it leaves
 *                        the viewport (Intersection Observer). Falls back to page
 *                        visibility alone when omitted.
 */
export function useBatchInvoicePolling(
  tokenIds: string[],
  walletAddress: string | undefined,
  sentinelRef?: React.RefObject<Element | null>
) {
  const queryClient = useQueryClient();
  const { mergeInvoicesBatch } = useInvoiceStore();

  // Track intersection visibility via a ref so the refetchInterval closure
  // always reads the latest value without causing re-renders.
  const isVisibleRef = useRef(true);

  useEffect(() => {
    if (!sentinelRef?.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [sentinelRef]);

  const enabled = tokenIds.length > 0 && !!walletAddress;

  const query = useQuery({
    queryKey: queryKeys.invoices.batch(tokenIds),
    queryFn: async () => {
      const invoices = await fetchBatchInvoicesByTokenIds(tokenIds, walletAddress!);
      // Merge into Zustand store so the rest of the UI stays in sync
      mergeInvoicesBatch(invoices);
      return invoices;
    },
    enabled,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
    refetchInterval: () => {
      // Pause when the tab is hidden
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return false;
      }
      // Pause when the sentinel element has scrolled out of view
      if (!isVisibleRef.current) {
        return false;
      }
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });

  // Also listen to the Page Visibility API and manually trigger a refetch when
  // the tab becomes visible again so the data is fresh immediately on return.
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({
          queryKey: queryKeys.invoices.batch(tokenIds),
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    // tokenIds is an array — stringify to avoid stale closure on identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, queryClient, tokenIds.join(",")]);

  return query;
}

// ─── Investor positions ───────────────────────────────────────────────────────

export function useInvestorPositions(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoices.positions(address ?? ""),
    queryFn: () => fetchInvestorPositions(address!),
    enabled: !!address,
    staleTime: STALE_30S,
    gcTime: GC_5MIN,
  });
}

// ─── Create invoice mutation ──────────────────────────────────────────────────

export function useInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      formData,
      ownerAddress,
      onProgress,
    }: {
      formData: CreateInvoiceFormData;
      ownerAddress: string;
      onProgress?: (p: number) => void;
    }) => prepareCreateInvoice(formData, ownerAddress, onProgress),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

// ─── Update invoice status mutation ──────────────────────────────────────────

export function useUpdateStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tokenId,
      from,
      to,
      ownerAddress,
    }: {
      tokenId: string;
      from: InvoiceStatus;
      to: InvoiceStatus;
      ownerAddress: string;
    }) => prepareUpdateInvoiceStatus(tokenId, from, to, ownerAddress),

    onSettled: (_data, _err, { tokenId, ownerAddress }) => {
      // Invalidate both the owner query and the individual detail so the UI
      // reflects the new status immediately after confirmation.
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.byOwner(ownerAddress) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(tokenId) });
    },
  });
}

export function useFundInvoiceMutation() {
  const queryClient = useQueryClient();
  const { updateInvoiceFunding } = useInvoiceStore();

  return useMutation({
    mutationFn: ({
      tokenId,
      amount,
      investorAddress,
    }: {
      tokenId: string;
      amount: number;
      investorAddress: string;
    }) => prepareFundInvoice(tokenId, amount, investorAddress),

    onMutate: async ({ tokenId, amount }) => {
      const { invoices } = useInvoiceStore.getState();
      const invoice = invoices.find((i) => i.tokenId === tokenId);
      if (invoice) {
        updateInvoiceFunding(invoice.id, invoice.funding.totalRaised + amount);
      }
    },

    onSettled: (_data, _err, { tokenId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(tokenId),
      });
    },
  });
}
