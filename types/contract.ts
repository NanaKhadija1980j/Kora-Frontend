// ─── Soroban Contract Types ───────────────────────────────────────────────────

export interface ContractConfig {
  invoiceContractId: string;
  marketplaceContractId: string;
  tokenContractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

export type TxStatus =
  | "idle"
  | "building"
  | "simulating"
  | "signing"
  | "submitting"
  | "polling"
  | "confirmed"
  | "failed"
  | "timeout";

export type TxState =
  | { status: "idle" }
  | { status: "building"; startedAt?: number }
  | { status: "simulating"; startedAt?: number }
  | {
      status: "signing";
      startedAt?: number;
      provider?: string;
      timeoutMs?: number;
      tips?: string[];
      canExtend?: boolean;
    }
  | { status: "submitting"; txHash?: string }
  | { status: "polling"; txHash: string }
  | { status: "confirmed"; txHash: string }
  | { status: "failed"; error: ServiceError; txHash?: string }
  | {
      status: "timeout";
      txHash?: string;
      provider?: string;
      timeoutMs?: number;
      canExtend?: boolean;
    };

export type ServiceErrorCode =
  | "NETWORK_ERROR"
  | "INVALID_INPUT"
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "ALREADY_FUNDED"
  | "INSUFFICIENT_BALANCE"
  | "ALREADY_REPAID"
  | "CAPACITY_EXCEEDED"
  | "INVALID_INVOICE_STATE"
  | "INCORRECT_REPAYMENT_AMOUNT"
  | "WALLET_ERROR"
  | "SIGNATURE_REJECTED"
  | "TRANSACTION_FAILED"
  | "SIMULATION_FAILED"
  | "SUBMISSION_FAILED"
  | "CONFIRMATION_TIMEOUT"
  | "IPFS_UPLOAD_FAILED"
  | "RATE_LIMITED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "VALIDATION_FAILED"
  | "INVALID_RESPONSE"
  | "FETCH_ERROR"
  | "INVALID_CID"
  | "IPFS_ERROR"
  | "IPFS_TAMPERED"
  | "CONTRACT_ERROR"
  | "SUBMISSION_ERROR"
  | "CONFIRMATION_ERROR"
  | "SUBMIT_ERROR"
  | "INVALID_FORM"
  | "CREATE_ERROR"
  | "FUND_ERROR"
  | "REPAY_ERROR"
  | "CLAIM_ERROR"
  | "CANCEL_ERROR"
  | "TRANSFER_ERROR"
  | "NOT_IMPLEMENTED"
  | "UNKNOWN_ERROR";

export interface ServiceError {
  code: ServiceErrorCode;
  message: string;
  details?: unknown;
  cause?: unknown;
}


// Mirrors the on-chain Invoice struct from the Soroban contract
export interface OnChainInvoice {
  token_id: bigint;
  owner: string;
  ipfs_cid: string;
  amount: bigint; // in stroops / smallest unit
  financing_amount: bigint;
  discount_rate: number; // basis points
  due_date: bigint; // Unix timestamp
  status: number; // enum index
  funded_amount: bigint;
}

export interface MintInvoiceParams {
  ipfsCid: string;
  amount: bigint;
  financingAmount: bigint;
  discountRate: number;
  dueDate: bigint;
}

export interface FundInvoiceParams {
  tokenId: bigint;
  amount: bigint;
}

export interface RepayInvoiceParams {
  tokenId: bigint;
}

export interface ClaimYieldParams {
  tokenId: bigint;
}

/**
 * P2P secondary-market transfer of an investor position (#443).
 *
 * ABI assumption: `transfer_position(position_id: u64, to: Address)` is a
 * single atomic call authorized by the position's current owner (the
 * `sourcePublicKey` signer), mirroring `claim_position`/`claim_yield`. The
 * recipient is not required to co-sign the transfer itself. If the deployed
 * contract instead requires a two-step propose/accept pattern, wire the
 * buyer's confirmation into `acceptPositionTransfer` in
 * services/invoiceService.ts, which is currently a documented stub.
 */
export interface TransferPositionParams {
  positionId: bigint;
  toAddress: string;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Filter / Sort Types ──────────────────────────────────────────────────────

export interface MarketplaceFilters {
  category?: string;
  jurisdiction?: string;
  riskTier?: string;
  currency?: string;
  minApr?: number;
  maxApr?: number;
  minAmount?: number;
  maxAmount?: number;
  status?: string;

  // Extended UI filter fields
  categories?: string[];
  jurisdictions?: string[];
  riskTiers?: string[];
  aprRange?: [number, number];
  activeOnly?: boolean;
}

export type MarketplaceSortKey = "apr" | "amount" | "duration" | "riskScore" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface MarketplaceSort {
  key: MarketplaceSortKey;
  direction: SortDirection;
}
