import type { FilterState, SortState } from "@/store/invoiceStore";
import { getNetworkMode, type NetworkMode } from "@/lib/featureFlags";

/**
 * Whether invoice queries resolve from mock data or the live indexer.
 *
 * Alias of {@link NetworkMode} — the data source and the network mode are the
 * same axis, and Issue #436 made `@/lib/featureFlags` the single definition so
 * key namespacing and query tuning can never disagree about which mode is
 * active. Kept as a named export for existing import sites.
 */
export type InvoiceDataSource = NetworkMode;

/**
 * Resolve the active invoice data source.
 *
 * Delegates to `getNetworkMode()`, which stays a plain env read so query keys
 * remain usable on the client and in unit tests without pulling in the full Zod
 * env module.
 */
export function getInvoiceDataSource(): InvoiceDataSource {
  return getNetworkMode();
}

export const queryKeys = {
  invoices: {
    all: ["invoices"] as const,
    list: (filters: FilterState, sort: SortState, page: number, source: InvoiceDataSource = getInvoiceDataSource()) =>
      ["invoices", "list", source, filters, sort, page] as const,
    /**
     * Infinite-scroll query key — includes filters, sortBy string, and page
     * size so any filter/sort change resets pagination automatically.
     */
    infinite: (filters: FilterState, sortBy: string, pageSize: number, source: InvoiceDataSource = getInvoiceDataSource()) =>
      ["invoices", "infinite", source, filters, sortBy, pageSize] as const,
    /**
     * Detail keys are namespaced by data source so mock and live indexer
     * responses never collide in the TanStack Query cache.
     */
    detail: (id: string, source: InvoiceDataSource = getInvoiceDataSource()) =>
      ["invoices", "detail", source, id] as const,
    byOwner: (address: string, source: InvoiceDataSource = getInvoiceDataSource()) =>
      ["invoices", "owner", source, address] as const,
    positions: (address: string, source: InvoiceDataSource = getInvoiceDataSource()) =>
      ["invoices", "positions", source, address] as const,
    batch: (tokenIds: string[]) =>
      ["invoices", "batch", [...tokenIds].sort().join(",")] as const,
  },
  kyc: {
    /** KYC status for a wallet. Funding gates read this, so it is its own key. */
    status: (address: string) => ["kyc", "status", address] as const,
    all: ["kyc"] as const,
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

export type QueryInvalidationEvent =
  | "mint_invoice"
  | "invoice_funded"
  | "invoice_repaid"
  | "invoice_cancelled"
  | "wallet_connected"
  | "wallet_disconnected"
  | "usdc_balance_changed"
  | "kyc_status_changed";

export interface QueryInvalidationContext {
  tokenId?: string;
  address?: string;
}

/**
 * Human-readable TanStack Query hierarchy.
 *
 * Keep this in sync with `queryKeys` so feature code and tests can reason about
 * broad-list invalidation versus narrow detail/account invalidation.
 */
export const queryKeyHierarchy = {
  invoices: {
    root: queryKeys.invoices.all,
    listPrefix: ["invoices", "list"] as const,
    infinitePrefix: ["invoices", "infinite"] as const,
    detailPrefix: ["invoices", "detail"] as const,
    ownerPrefix: ["invoices", "owner"] as const,
    positionsPrefix: ["invoices", "positions"] as const,
    batchPrefix: ["invoices", "batch"] as const,
  },
  kyc: {
    root: ["kyc"] as const,
    statusPrefix: ["kyc", "status"] as const,
  },
  account: {
    rootPrefix: ["account"] as const,
    balancesSegment: "balances",
    transactionsSegment: "transactions",
    existsSegment: "exists",
    usdcSegment: "usdc",
  },
} as const;

/**
 * Central invalidation map for mutation/event side effects.
 *
 * Rules return concrete query keys whenever possible. Prefix keys such as
 * `queryKeys.invoices.all` intentionally invalidate every invoice list/detail
 * descendant through TanStack Query's partial-key matching.
 */
export const queryInvalidationRules = {
  mint_invoice: () => [queryKeys.invoices.all],
  invoice_funded: ({ tokenId }: QueryInvalidationContext) => [
    ...(tokenId ? [queryKeys.invoices.detail(tokenId)] : []),
    queryKeys.invoices.all,
  ],
  invoice_repaid: ({ tokenId }: QueryInvalidationContext) => [
    ...(tokenId ? [queryKeys.invoices.detail(tokenId)] : []),
    queryKeys.invoices.all,
    queryKeyHierarchy.invoices.positionsPrefix,
  ],
  invoice_cancelled: ({ tokenId }: QueryInvalidationContext) => [
    ...(tokenId ? [queryKeys.invoices.detail(tokenId)] : []),
    queryKeys.invoices.all,
  ],
  wallet_connected: ({ address }: QueryInvalidationContext) => [
    ...(address ? [queryKeys.account.all(address)] : []),
  ],
  wallet_disconnected: ({ address }: QueryInvalidationContext) => [
    ...(address ? [queryKeys.account.all(address)] : []),
  ],
  usdc_balance_changed: ({ address }: QueryInvalidationContext) => [
    ...(address ? [queryKeys.account.usdcBalance(address)] : []),
  ],
  /**
   * A KYC transition opens or closes the funding gate, so the invoice lists and
   * details that render it have to re-evaluate alongside the status itself.
   */
  kyc_status_changed: ({ address }: QueryInvalidationContext) => [
    ...(address ? [queryKeys.kyc.status(address)] : [queryKeys.kyc.all]),
    queryKeys.invoices.all,
  ],
} satisfies Record<
  QueryInvalidationEvent,
  (context: QueryInvalidationContext) => ReadonlyArray<readonly unknown[]>
>;

export function getInvalidationKeys(
  event: QueryInvalidationEvent,
  context: QueryInvalidationContext = {}
): ReadonlyArray<readonly unknown[]> {
  return queryInvalidationRules[event](context);
}
