/**
 * Soroban RPC Event Indexer Client for Kora Invoices.
 * Ingests `mint_invoice`, `invoice_funded`, `invoice_repaid`, and `invoice_cancelled` events
 * from Soroban RPC, builds and maintains invoice state with IPFS metadata enrichment,
 * and provides paginated, filtered, and sorted query methods.
 */
import { getContractEvents, type ContractEvent, type KoraEventType } from "./client";
import type { Invoice, MarketplaceFilters, MarketplaceSort, PaginatedResponse, DebtorPrivacyLevel } from "@/types";
import { fetchIpfsJsonWithFallback, isValidCID } from "@/lib/ipfs";
import { sanitizeIpfsMetadata } from "@/lib/security";
import { env } from "@/lib/env";

export interface IndexerQueryOptions {
  filters?: MarketplaceFilters;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export class RpcNetworkError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "RpcNetworkError";
  }
}

export class StellarIndexerClient {
  private indexedInvoices: Map<string, Invoice> = new Map();
  private lastIngestedLedger: number = 0;
  private isIngesting: boolean = false;
  private contractId: string;

  constructor(contractId?: string) {
    this.contractId =
      contractId ||
      env.NEXT_PUBLIC_INVOICE_CONTRACT_ID ||
      env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID ||
      "";
  }

  /** Reset internal indexer cache (useful for testing) */
  reset(): void {
    this.indexedInvoices.clear();
    this.lastIngestedLedger = 0;
    this.isIngesting = false;
  }

  /**
   * Sync contract events from Soroban RPC.
   */
  async syncEvents(startLedger?: number): Promise<number> {
    if (this.isIngesting) return this.lastIngestedLedger;
    this.isIngesting = true;

    try {
      const fromLedger = startLedger ?? this.lastIngestedLedger;
      const contractIds = Array.from(
        new Set(
          [
            env.NEXT_PUBLIC_INVOICE_CONTRACT_ID,
            env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID,
            this.contractId,
          ].filter(Boolean)
        )
      );

      const eventTypes: KoraEventType[] = [
        "mint_invoice",
        "invoice_funded",
        "invoice_repaid",
        "invoice_cancelled",
      ];

      for (const cid of contractIds) {
        if (!cid) continue;
        const { events, latestLedger } = await getContractEvents({
          contractId: cid,
          eventTypes,
          startLedger: fromLedger,
        });

        if (latestLedger > this.lastIngestedLedger) {
          this.lastIngestedLedger = latestLedger;
        }

        await this.processEvents(events);
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[StellarIndexerClient] Error syncing events:", err);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new RpcNetworkError(`Soroban RPC sync failed: ${msg}`, err);
    } finally {
      this.isIngesting = false;
    }

    return this.lastIngestedLedger;
  }

  /**
   * Directly ingest event objects into the indexer cache.
   */
  async processEvents(events: ContractEvent[]): Promise<void> {
    for (const event of events) {
      switch (event.type) {
        case "mint_invoice":
          await this.handleMintInvoiceEvent(event);
          break;
        case "invoice_funded":
          this.handleInvoiceFundedEvent(event);
          break;
        case "invoice_repaid":
          this.handleInvoiceRepaidEvent(event);
          break;
        case "invoice_cancelled":
          this.handleInvoiceCancelledEvent(event);
          break;
      }
    }
  }

  /**
   * Manually add or update an invoice in the indexer cache.
   */
  addInvoice(invoice: Invoice): void {
    this.indexedInvoices.set(invoice.id, invoice);
    if (invoice.tokenId) {
      this.indexedInvoices.set(invoice.tokenId, invoice);
    }
  }

  /**
   * Get all indexed invoices applying filters, sorting, and pagination.
   *
   * Pagination Translation Strategy:
   * Soroban RPC event queries are cursor-based (using ledger numbers), whereas the frontend
   * relies on standard page/pageSize offset-based pagination. To bridge these two models,
   * this client implements sequential event syncing up to the latest ledger to fully rebuild
   * the current state of all invoices in memory (`indexedInvoices`).
   *
   * Once the complete, up-to-date invoice collection is present in memory, it is post-filtered
   * and sorted entirely client-side. Offset pagination is then performed by slicing the in-memory
   * array at `(page - 1) * pageSize`. Alternatively, if a `cursor` (tokenId) is passed, we locate
   * the index of the cursor invoice and slice from the subsequent entry.
   *
   * This design provides the following advantages:
   * 1. Direct offset-based pagination is perfectly supported without requiring indexer API changes.
   * 2. Supports multi-field post-filtering and sorting over live-synced events.
   * 3. Avoids cursor drift when elements are added or modified.
   */
  async getInvoices(
    filters: MarketplaceFilters = {},
    sort: MarketplaceSort = { key: "apr", direction: "desc" },
    page = 1,
    pageSize = 12,
    cursor?: string
  ): Promise<PaginatedResponse<Invoice>> {
    await this.syncEvents();

    let invoices = Array.from(new Set(this.indexedInvoices.values()));

    // Apply filters
    invoices = this.applyFilters(invoices, filters);

    // Apply sort
    invoices = this.applySort(invoices, sort);

    // Apply cursor or page-based pagination
    let startIndex = (page - 1) * pageSize;
    if (cursor) {
      const cursorIndex = invoices.findIndex(
        (i) => i.id === cursor || i.tokenId === cursor
      );
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const total = invoices.length;
    const paginatedData = invoices.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < total;

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      hasMore,
    };
  }

  /**
   * Get invoices owned by a specific address.
   */
  async getInvoicesByOwner(ownerAddress: string): Promise<Invoice[]> {
    await this.syncEvents();
    const invoices = Array.from(new Set(this.indexedInvoices.values()));
    return invoices.filter(
      (inv) => inv.ownerAddress?.toLowerCase() === ownerAddress.toLowerCase()
    );
  }

  private async handleMintInvoiceEvent(event: ContractEvent): Promise<void> {
    const tokenId = event.tokenId;
    if (!tokenId) return;

    const id = `inv_${tokenId}`;
    const existing = this.indexedInvoices.get(id);

    const ownerAddress =
      event.participantAddress || (event.rawTopics[2] ?? "");
    const ipfsCid = event.rawTopics[3] || "";
    const amount = event.amount || 0;

    let metadata: any = {
      invoiceNumber: `INV-${tokenId}`,
      issuerName: "",
      issuerAddress: ownerAddress,
      debtorName: "",
      debtorAddress: "",
      amount,
      currency: "USDC",
      issueDate: event.ledgerClosedAt || new Date().toISOString(),
      dueDate: new Date().toISOString(),
      description: "",
      jurisdiction: "OTHER",
      category: "other",
      documentHash: ipfsCid,
      documentUrl: ipfsCid ? `${env.NEXT_PUBLIC_IPFS_GATEWAY}/${ipfsCid}` : "",
    };

    if (ipfsCid && isValidCID(ipfsCid)) {
      try {
        const { data } = await fetchIpfsJsonWithFallback<Record<string, unknown>>(
          ipfsCid,
          {
            timeoutMs: 5_000,
            skipIntegrity: env.NEXT_PUBLIC_ENABLE_MOCK_DATA,
          }
        );
        const sanitized = sanitizeIpfsMetadata(data);
        metadata = { ...metadata, ...sanitized };
      } catch {
        // Safe fallback when IPFS metadata fails
      }
    }

    const financingAmount = metadata.amount || amount;
    const tenorDays = metadata.tenor ? Number(metadata.tenor) : 90;
    const discountRate = metadata.discountRate ? Number(metadata.discountRate) : 0.05;
    const apr = metadata.apr ?? discountRate * (365 / tenorDays) * 100;

    const invoice: Invoice = existing || {
      id,
      tokenId,
      contractAddress: event.contractId || env.NEXT_PUBLIC_INVOICE_CONTRACT_ID || "",
      ipfsCid,
      metadata,
      terms: {
        discountRate,
        apr,
        financingAmount,
        minInvestment: 0,
        maxInvestment: financingAmount,
        tenor: tenorDays,
        repaymentDate: metadata.dueDate,
      },
      funding: {
        totalRaised: 0,
        targetAmount: financingAmount,
        fundingProgress: 0,
        investorCount: 0,
        remainingCapacity: financingAmount,
      },
      riskTier: "A",
      riskScore: 0,
      debtorPrivacy: (metadata.debtorPrivacy as DebtorPrivacyLevel) || "anonymized",
      status: "listed",
      createdAt: event.ledgerClosedAt || new Date().toISOString(),
      updatedAt: event.ledgerClosedAt || new Date().toISOString(),
      ownerAddress,
    };

    this.addInvoice(invoice);
  }

  private handleInvoiceFundedEvent(event: ContractEvent): void {
    const tokenId = event.tokenId;
    if (!tokenId) return;

    const invoice =
      this.indexedInvoices.get(`inv_${tokenId}`) ||
      this.indexedInvoices.get(tokenId);
    if (!invoice) return;

    const addedAmount = event.amount;
    const newTotalRaised = invoice.funding.totalRaised + addedAmount;
    const target = invoice.funding.targetAmount;
    const isFull = target > 0 && newTotalRaised >= target;

    invoice.funding.totalRaised = newTotalRaised;
    invoice.funding.remainingCapacity = Math.max(0, target - newTotalRaised);
    invoice.funding.fundingProgress = target > 0 ? Math.min(newTotalRaised / target, 1) : 0;
    invoice.funding.investorCount += 1;
    invoice.status = isFull ? "fully_funded" : "partially_funded";
    invoice.updatedAt = event.ledgerClosedAt || new Date().toISOString();
  }

  private handleInvoiceRepaidEvent(event: ContractEvent): void {
    const tokenId = event.tokenId;
    if (!tokenId) return;

    const invoice =
      this.indexedInvoices.get(`inv_${tokenId}`) ||
      this.indexedInvoices.get(tokenId);
    if (!invoice) return;

    invoice.status = "repaid";
    invoice.updatedAt = event.ledgerClosedAt || new Date().toISOString();
  }

  private handleInvoiceCancelledEvent(event: ContractEvent): void {
    const tokenId = event.tokenId;
    if (!tokenId) return;

    const invoice =
      this.indexedInvoices.get(`inv_${tokenId}`) ||
      this.indexedInvoices.get(tokenId);
    if (!invoice) return;

    invoice.status = "cancelled";
    invoice.updatedAt = event.ledgerClosedAt || new Date().toISOString();
  }

  public applyFilters(data: Invoice[], filters: MarketplaceFilters): Invoice[] {
    let result = [...data];

    if (filters.category) {
      result = result.filter((i) => i.metadata.category === filters.category);
    }
    if (filters.categories && filters.categories.length > 0) {
      result = result.filter((i) => filters.categories!.includes(i.metadata.category));
    }
    if (filters.jurisdiction) {
      result = result.filter((i) => i.metadata.jurisdiction === filters.jurisdiction);
    }
    if (filters.jurisdictions && filters.jurisdictions.length > 0) {
      result = result.filter((i) => filters.jurisdictions!.includes(i.metadata.jurisdiction));
    }
    if (filters.riskTier) {
      result = result.filter((i) => i.riskTier === filters.riskTier);
    }
    if (filters.riskTiers && filters.riskTiers.length > 0) {
      result = result.filter((i) => filters.riskTiers!.includes(i.riskTier));
    }
    if (filters.currency) {
      result = result.filter((i) => i.metadata.currency === filters.currency);
    }
    if (filters.minApr !== undefined) {
      result = result.filter((i) => i.terms.apr >= filters.minApr!);
    }
    if (filters.maxApr !== undefined) {
      result = result.filter((i) => i.terms.apr <= filters.maxApr!);
    }
    if (filters.aprRange) {
      const [min, max] = filters.aprRange;
      result = result.filter((i) => i.terms.apr >= min && i.terms.apr <= max);
    }
    if (filters.minAmount !== undefined) {
      result = result.filter((i) => i.metadata.amount >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      result = result.filter((i) => i.metadata.amount <= filters.maxAmount!);
    }
    if (filters.status) {
      result = result.filter((i) => i.status === filters.status);
    }
    if (filters.activeOnly) {
      result = result.filter((i) => i.status === "listed" || i.status === "partially_funded");
    }

    return result;
  }

  public applySort(data: Invoice[], sort: MarketplaceSort): Invoice[] {
    const result = [...data];
    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sort.key) {
        case "apr":
          aVal = a.terms.apr;
          bVal = b.terms.apr;
          break;
        case "amount":
          aVal = a.metadata.amount;
          bVal = b.metadata.amount;
          break;
        case "duration":
          aVal = a.terms.tenor;
          bVal = b.terms.tenor;
          break;
        case "riskScore":
          aVal = a.riskScore;
          bVal = b.riskScore;
          break;
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
      }
      return sort.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
    return result;
  }
}

export const indexerClient = new StellarIndexerClient();
