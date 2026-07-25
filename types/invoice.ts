// ─── Invoice Types ────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | "draft"
  | "pending_mint"
  | "listed"
  | "partially_funded"
  | "fully_funded"
  | "active"
  | "repaid"
  | "defaulted"
  | "cancelled";

export type InvoiceDraft = InvoiceBase & { status: "draft"; txHash?: undefined };
export type InvoicePendingMint = InvoiceBase & { status: "pending_mint"; txHash?: string };
export type InvoiceListed = InvoiceBase & { status: "listed" };
export type InvoicePartiallyFunded = InvoiceBase & { status: "partially_funded" };
export type InvoiceFullyFunded = InvoiceBase & { status: "fully_funded" };
export type InvoiceActive = InvoiceBase & { status: "active" };
export type InvoiceRepaid = InvoiceBase & { status: "repaid" };
export type InvoiceDefaulted = InvoiceBase & { status: "defaulted" };
export type InvoiceCancelled = InvoiceBase & { status: "cancelled" };

export type RiskTier = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC";

export type DebtorPrivacyLevel = "full" | "partial" | "anonymized";

export type InvoiceCurrency = "USDC" | "EURC" | "XLM";

export type InvoiceJurisdiction = "US" | "EU" | "UK" | "NG" | "KE" | "GH" | "ZA" | "OTHER";

export type InvoiceCategory =
  | "technology"
  | "manufacturing"
  | "logistics"
  | "healthcare"
  | "retail"
  | "construction"
  | "agriculture"
  | "energy"
  | "finance"
  | "other";

export interface InvoiceMetadata {
  invoiceNumber: string;
  issuerName: string;
  issuerAddress: string;
  debtorName: string;
  debtorAddress: string;
  amount: number;
  currency: InvoiceCurrency;
  issueDate: string; // ISO 8601
  dueDate: string; // ISO 8601
  description: string;
  jurisdiction: InvoiceJurisdiction;
  category: InvoiceCategory;
  documentHash: string; // IPFS CID of the PDF
  documentUrl: string;
  /** Detected IPFS metadata schema version ("1.0" | "legacy"). Optional. */
  metadataVersion?: "1.0" | "legacy";
}

export interface InvoiceFinancingTerms {
  discountRate: number; // e.g. 0.05 = 5%
  apr: number; // annualised percentage rate
  financingAmount: number; // amount being raised (< invoice amount)
  minInvestment: number;
  maxInvestment: number;
  tenor: number; // days until repayment
  repaymentDate: string; // ISO 8601
}

export interface InvoiceFunding {
  totalRaised: number;
  targetAmount: number;
  fundingProgress: number; // 0–1
  investorCount: number;
  remainingCapacity: number;
}

export interface InvoiceBase {
  id: string;
  tokenId: string; // on-chain NFT token ID
  contractAddress: string;
  ipfsCid: string;
  metadata: InvoiceMetadata;
  terms: InvoiceFinancingTerms;
  funding: InvoiceFunding;
  riskTier: RiskTier;
  riskScore: number; // 0–100
  debtorPrivacy: DebtorPrivacyLevel;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  ownerAddress: string; // SME wallet
  txHash?: string; // mint transaction
  listingExpiry?: string; // ISO 8601, when listing expires from marketplace
}

export type Invoice =
  | InvoiceDraft
  | InvoicePendingMint
  | InvoiceListed
  | InvoicePartiallyFunded
  | InvoiceFullyFunded
  | InvoiceActive
  | InvoiceRepaid
  | InvoiceDefaulted
  | InvoiceCancelled;

export interface InvoicePosition {
  invoiceId: string;
  invoice: Invoice;
  investedAmount: number;
  expectedReturn: number;
  yieldEarned: number;
  investedAt: string;
  status: "active" | "repaid" | "defaulted";
}

export interface InvestorPosition {
  id: string;
  invoiceId: string;
  invoice?: Invoice;
  investedAmount: number;
  expectedReturn: number;
  yieldEarned: number;
  investedAt: string;
  status: "active" | "repaid" | "defaulted";
}

// ─── Create Invoice Form ──────────────────────────────────────────────────────

export interface CreateInvoiceFormData {
  invoiceNumber: string;
  debtorName: string;
  debtorAddress: string;
  amount: number;
  currency: InvoiceCurrency;
  issueDate: string;
  dueDate: string;
  description: string;
  jurisdiction: InvoiceJurisdiction;
  category: InvoiceCategory;
  debtorPrivacy: DebtorPrivacyLevel;
  discountRate: number;
  minInvestment: number;
  listingExpiryDate: string;
  document: File | null;
}

// ─── Invoice Status State Machine ────────────────────────────────────────────

/**
 * Allowed status transitions for the SME owner.
 * State machine: Active → Funded → Repaid, Active → Cancelled
 *
 * Frontend status strings map to on-chain status codes via ON_CHAIN_STATUS_MAP
 * in invoiceService.ts.  Only the transitions below are legal; all others are
 * blocked client-side with a tooltip explaining why.
 */
export const INVOICE_STATUS_TRANSITIONS: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
  active: ["fully_funded", "cancelled"],
  fully_funded: ["repaid"],
};

export interface StatusTransition {
  from: InvoiceStatus;
  to: InvoiceStatus;
  label: string;
  /** Tooltip shown on the button */
  description: string;
  /** Variant applied to the button */
  variant: "default" | "destructive" | "outline";
}

/** All valid transitions with their UI metadata */
export const STATUS_TRANSITION_DEFS: StatusTransition[] = [
  {
    from: "active",
    to: "fully_funded",
    label: "Mark Funded",
    description: "Mark this invoice as fully funded by an investor.",
    variant: "default",
  },
  {
    from: "active",
    to: "cancelled",
    label: "Cancel",
    description: "Cancel this invoice. This action cannot be undone.",
    variant: "destructive",
  },
  {
    from: "fully_funded",
    to: "repaid",
    label: "Mark Repaid",
    description: "Confirm repayment and distribute yield to investors.",
    variant: "default",
  },
];

/**
 * Returns the valid next statuses the owner can transition to from `current`.
 * Returns an empty array when no transitions are available.
 */
export function getAllowedTransitions(current: InvoiceStatus): InvoiceStatus[] {
  return INVOICE_STATUS_TRANSITIONS[current] ?? [];
}

/**
 * Returns the transition definitions available for a given status.
 */
export function getTransitionDefs(current: InvoiceStatus): StatusTransition[] {
  return STATUS_TRANSITION_DEFS.filter((t) => t.from === current);
}
