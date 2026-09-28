// ─── Result Type ──────────────────────────────────────────────────────────────
// Standard Result pattern for explicit error handling
export type Result<T, E = ServiceError> = { ok: true; value: T } | { ok: false; error: E };

// ─── Service Error ────────────────────────────────────────────────────────────
// Imported from ./contract

// ─── Invoice Service Interface ────────────────────────────────────────────────
import type {
  Invoice,
  CreateInvoiceFormData,
  InvoicePosition,
} from "./invoice";
import type {
  PaginatedResponse,
  MarketplaceFilters,
  MarketplaceSort,
  ServiceError,
} from "./contract";

export interface IInvoiceService {
  // ─── Read Operations ──────────────────────────────────────────────────
  getInvoices(
    filters?: MarketplaceFilters,
    sort?: MarketplaceSort,
    page?: number,
    pageSize?: number
  ): Promise<Result<PaginatedResponse<Invoice>>>;

  getInvoice(id: string, sourcePublicKey?: string): Promise<Result<Invoice | null>>;

  getInvoicesByOwner(ownerAddress: string): Promise<Result<Invoice[]>>;

  getPositions(investorAddress: string): Promise<Result<InvoicePosition[]>>;

  getIpfsMetadata(cid: string): Promise<Result<Record<string, unknown>>>;

  // ─── Write Operations ─────────────────────────────────────────────────
  createInvoice(
    formData: CreateInvoiceFormData,
    ownerAddress: string,
    onProgress?: (progress: number) => void
  ): Promise<Result<{ unsignedXdr: string; metadataCid: string }>>;

  fundInvoice(
    tokenId: string,
    amount: number,
    investorAddress: string
  ): Promise<Result<string>>;

  repayInvoice(
    tokenId: string,
    ownerAddress: string,
    invoiceOwnerAddress?: string
  ): Promise<Result<string>>;

  claimPosition(positionId: string, investorAddress: string): Promise<Result<string>>;

  /**
   * Cancel an active or listed invoice.
   * Note on Live Mode On-Chain Limitations:
   * The Soroban contract `cancel_invoice` entry point takes (token_id, owner).
   * Structured cancellation reasons are captured for compliance/support and
   * stored in local audit logs / transaction history.
   */
  cancelInvoice(tokenId: string, ownerAddress: string, reason?: string): Promise<Result<string>>;

  /**
   * Transfer an investor position to a new owner (P2P secondary-market
   * sale). Returns unsigned XDR string, signed by `sellerAddress` (the
   * current position owner).
   */
  transferPosition(
    positionId: string,
    toAddress: string,
    sellerAddress: string
  ): Promise<Result<string>>;

  submitTransaction(signedXdr: string): Promise<Result<string>>;
}
