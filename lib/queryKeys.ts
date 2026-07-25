import type { FilterState, SortState } from "@/store/invoiceStore";

/** Whether invoice queries resolve from mock data or the live indexer. */
export type InvoiceDataSource = "mock" | "live";

/**
 * Resolve the active invoice data source from env.
 * Kept as a pure process.env read so query keys stay usable in client + tests
 * without pulling the full Zod env module.
 */
export function getInvoiceDataSource(): InvoiceDataSource {
  return process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === "true" ? "mock" : "live";
}

export const queryKeys = {
  invoices: {
    all: ["invoices"] as const,
    list: (filters: FilterState, sort: SortState, page: number) =>
      ["invoices", "list", filters, sort, page] as const,
    infinite: (filters: FilterState, sort: string | SortState, pageSize: number) =>
      ["invoices", "infinite", filters, sort, pageSize] as const,
    /**
     * Detail keys are namespaced by data source so mock and live indexer
     * responses never collide in the TanStack Query cache.
     */
    detail: (id: string, source: InvoiceDataSource = getInvoiceDataSource()) =>
      ["invoices", "detail", source, id] as const,
    byOwner: (address: string) => ["invoices", "owner", address] as const,
    positions: (address: string) => ["invoices", "positions", address] as const,
    batch: (tokenIds: string[]) =>
      ["invoices", "batch", [...tokenIds].sort().join(",")] as const,
  },
  account: {
    all: (address: string) => ["account", address] as const,
    balances: (address: string) => ["account", address, "balances"] as const,
    transactions: (address: string, limit?: number, cursor?: string) =>
      ["account", address, "transactions", limit, cursor] as const,
    exists: (address: string) => ["account", address, "exists"] as const,
    usdcBalance: (address: string) => ["account", address, "usdc"] as const,
  },
} as const;
