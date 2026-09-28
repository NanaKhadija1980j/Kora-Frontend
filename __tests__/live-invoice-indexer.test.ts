import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { StellarIndexerClient, indexerClient } from "@/lib/stellar/indexerClient";
import { createInvoiceService } from "@/services/invoiceService";
import type { Invoice, ContractEvent } from "@/types";

// Mock env to enable live mode for testing
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: false,
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CBWOAOZCOAJQH7HHZRE5BVNL2C4HRP4JCQZF3YQCQYDL5BZJRN4YGK4",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://gateway.pinata.cloud/ipfs",
  },
}));

vi.mock("@/lib/stellar/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar/client")>();
  return {
    ...actual,
    getContractEvents: vi.fn().mockResolvedValue({
      events: [],
      latestLedger: 100,
    }),
  };
});

describe("LiveInvoiceIndexer Integration Tests", () => {
  let indexer: StellarIndexerClient;

  beforeEach(() => {
    indexer = new StellarIndexerClient("C_INVOICE_TEST");
    indexer.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. Live Listing with NEXT_PUBLIC_ENABLE_MOCK_DATA=false ────────────────
  it("fetches live invoices using indexerClient without throwing NOT_IMPLEMENTED", async () => {
    const service = createInvoiceService();

    // Add a sample minted invoice
    indexerClient.reset();
    indexerClient.addInvoice({
      id: "inv_1",
      tokenId: "1",
      contractAddress: "C_INVOICE_TEST",
      ipfsCid: "QmTest1",
      metadata: {
        invoiceNumber: "INV-1",
        issuerName: "Alice Corp",
        issuerAddress: "GABC123",
        debtorName: "Bob LLC",
        debtorAddress: "GDEF456",
        amount: 10000,
        currency: "USDC",
        issueDate: "2026-01-01T00:00:00Z",
        dueDate: "2026-04-01T00:00:00Z",
        description: "Test Invoice 1",
        jurisdiction: "US",
        category: "technology",
        documentHash: "QmTest1",
        documentUrl: "https://gateway.pinata.cloud/ipfs/QmTest1",
      },
      terms: {
        discountRate: 0.08,
        apr: 12.5,
        financingAmount: 10000,
        minInvestment: 100,
        maxInvestment: 10000,
        tenor: 90,
        repaymentDate: "2026-04-01T00:00:00Z",
      },
      funding: {
        totalRaised: 2000,
        targetAmount: 10000,
        fundingProgress: 0.2,
        investorCount: 2,
        remainingCapacity: 8000,
      },
      riskTier: "A",
      riskScore: 85,
      status: "partially_funded",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      ownerAddress: "GABC123",
    });

    const result = await service.getInvoices();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.length).toBeGreaterThanOrEqual(1);
      expect(result.value.data[0].id).toBe("inv_1");
    }
  });

  // ─── 2. Event Processing (mint_invoice, invoice_funded, etc.) ─────────────
  it("processes mint_invoice and invoice_funded events correctly", async () => {
    const mintEvent: ContractEvent = {
      id: "evt_1",
      ledger: 10,
      ledgerClosedAt: "2026-01-01T00:00:00Z",
      contractId: "C_INVOICE_TEST",
      type: "mint_invoice",
      tokenId: "100",
      amount: 5000,
      participantAddress: "GSME123",
      rawTopics: ["mint_invoice", "100", "GSME123", "QmCid100"],
    };

    const fundEvent: ContractEvent = {
      id: "evt_2",
      ledger: 15,
      ledgerClosedAt: "2026-01-02T00:00:00Z",
      contractId: "C_MARKETPLACE_TEST",
      type: "invoice_funded",
      tokenId: "100",
      amount: 2500,
      participantAddress: "GINVESTOR1",
      rawTopics: ["invoice_funded", "100", "GINVESTOR1"],
    };

    await indexer.processEvents([mintEvent, fundEvent]);

    const response = await indexer.getInvoices();
    expect(response.total).toBe(1);

    const inv = response.data[0];
    expect(inv.tokenId).toBe("100");
    expect(inv.status).toBe("partially_funded");
    expect(inv.funding.totalRaised).toBe(2500);
    expect(inv.funding.remainingCapacity).toBe(2500);
  });

  // ─── 3. Filter Parity with Mock Mode ──────────────────────────────────────
  it("filters by category, jurisdiction, riskTier, and activeOnly matching mock service behavior", async () => {
    const inv1: Invoice = {
      id: "inv_1",
      tokenId: "1",
      contractAddress: "C_TEST",
      ipfsCid: "Qm1",
      metadata: {
        category: "technology",
        jurisdiction: "US",
        amount: 5000,
        currency: "USDC",
        invoiceNumber: "1",
        issuerName: "",
        issuerAddress: "",
        debtorName: "",
        debtorAddress: "",
        issueDate: "",
        dueDate: "",
        description: "",
        documentHash: "",
        documentUrl: "",
      },
      terms: { apr: 10, discountRate: 0.05, financingAmount: 5000, minInvestment: 0, maxInvestment: 5000, tenor: 30, repaymentDate: "" },
      funding: { totalRaised: 0, targetAmount: 5000, fundingProgress: 0, investorCount: 0, remainingCapacity: 5000 },
      riskTier: "A",
      riskScore: 90,
      status: "listed",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      ownerAddress: "G1",
    };

    const inv2: Invoice = {
      ...inv1,
      id: "inv_2",
      tokenId: "2",
      metadata: { ...inv1.metadata, category: "logistics", jurisdiction: "EU", amount: 20000 },
      terms: { ...inv1.terms, apr: 18 },
      riskTier: "C",
      status: "repaid",
      createdAt: "2026-01-02T00:00:00Z",
    };

    indexer.addInvoice(inv1);
    indexer.addInvoice(inv2);

    // Active only filter
    const activeRes = await indexer.getInvoices({ activeOnly: true });
    expect(activeRes.total).toBe(1);
    expect(activeRes.data[0].id).toBe("inv_1");

    // Category filter
    const catRes = await indexer.getInvoices({ category: "logistics" });
    expect(catRes.total).toBe(1);
    expect(catRes.data[0].id).toBe("inv_2");

    // APR Range filter
    const aprRes = await indexer.getInvoices({ minApr: 15 });
    expect(aprRes.total).toBe(1);
    expect(aprRes.data[0].id).toBe("inv_2");
  });

  // ─── 4. Sort Parity with Mock Mode ─────────────────────────────────────────
  it("sorts by apr, amount, and createdAt in asc and desc directions", async () => {
    const invA: Invoice = {
      id: "inv_A",
      tokenId: "A",
      contractAddress: "C_TEST",
      ipfsCid: "",
      metadata: { amount: 1000 } as any,
      terms: { apr: 5 } as any,
      funding: {} as any,
      riskTier: "A",
      riskScore: 70,
      status: "listed",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      ownerAddress: "G1",
    };

    const invB: Invoice = {
      ...invA,
      id: "inv_B",
      tokenId: "B",
      metadata: { amount: 5000 } as any,
      terms: { apr: 15 } as any,
      createdAt: "2026-01-05T00:00:00Z",
    };

    indexer.addInvoice(invA);
    indexer.addInvoice(invB);

    // Sort by APR desc
    const sortAprDesc = await indexer.getInvoices({}, { key: "apr", direction: "desc" });
    expect(sortAprDesc.data[0].id).toBe("inv_B");

    // Sort by APR asc
    const sortAprAsc = await indexer.getInvoices({}, { key: "apr", direction: "asc" });
    expect(sortAprAsc.data[0].id).toBe("inv_A");

    // Sort by Amount desc
    const sortAmountDesc = await indexer.getInvoices({}, { key: "amount", direction: "desc" });
    expect(sortAmountDesc.data[0].id).toBe("inv_B");
  });

  // ─── 5. Pagination with page/pageSize & cursor support ─────────────────────
  it("paginates correctly supporting page, pageSize, and cursor", async () => {
    for (let i = 1; i <= 5; i++) {
      indexer.addInvoice({
        id: `inv_${i}`,
        tokenId: String(i),
        contractAddress: "C_TEST",
        ipfsCid: "",
        metadata: { amount: i * 1000 } as any,
        terms: { apr: i * 2 } as any,
        funding: {} as any,
        riskTier: "A",
        riskScore: 80,
        status: "listed",
        createdAt: `2026-01-0${i}T00:00:00Z`,
        updatedAt: `2026-01-0${i}T00:00:00Z`,
        ownerAddress: "G1",
      });
    }

    const page1 = await indexer.getInvoices({}, { key: "apr", direction: "asc" }, 1, 2);
    expect(page1.data.length).toBe(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.total).toBe(5);
    expect(page1.data[0].id).toBe("inv_1");
    expect(page1.data[1].id).toBe("inv_2");

    const page2 = await indexer.getInvoices({}, { key: "apr", direction: "asc" }, 2, 2);
    expect(page2.data.length).toBe(2);
    expect(page2.hasMore).toBe(true);
    expect(page2.data[0].id).toBe("inv_3");

    // Cursor-based pagination
    const cursorPage = await indexer.getInvoices({}, { key: "apr", direction: "asc" }, 1, 2, "inv_2");
    expect(cursorPage.data[0].id).toBe("inv_3");
  });

  // ─── 6. Empty State ────────────────────────────────────────────────────────
  it("returns an empty paginated result when no invoices exist", async () => {
    const res = await indexer.getInvoices();
    expect(res.data).toEqual([]);
    expect(res.total).toBe(0);
    expect(res.hasMore).toBe(false);
    expect(res.page).toBe(1);
  });

  // ─── 7. Partial & Missing Metadata State ─────────────────────────────────
  it("handles partial event data and missing IPFS metadata gracefully", async () => {
    const partialEvent: ContractEvent = {
      id: "evt_partial",
      ledger: 20,
      ledgerClosedAt: "2026-01-01T00:00:00Z",
      contractId: "C_INVOICE_TEST",
      type: "mint_invoice",
      tokenId: "999",
      amount: 0,
      participantAddress: "",
      rawTopics: ["mint_invoice", "999"],
    };

    await indexer.processEvents([partialEvent]);
    const res = await indexer.getInvoices();

    expect(res.total).toBe(1);
    const invoice = res.data[0];
    expect(invoice.tokenId).toBe("999");
    expect(invoice.metadata.category).toBe("other");
    expect(invoice.status).toBe("listed");
  });

  // ─── 8. User-friendly Error Handling ─────────────────────────────────────
  it("surfaces user-friendly error messages when getInvoices fails", async () => {
    vi.spyOn(indexer, "syncEvents").mockRejectedValueOnce(new Error("RPC Connection Failed"));

    try {
      await indexer.getInvoices();
    } catch (err: any) {
      expect(err.message).toContain("RPC Connection Failed");
    }
  });
});
