/**
 * Integration coverage for the mock/live InvoiceService factory switch.
 *
 * createInvoiceService() picks MockInvoiceService or LiveInvoiceService based
 * on env.NEXT_PUBLIC_ENABLE_MOCK_DATA. These tests mock the Soroban RPC layer
 * (lib/stellar/contracts, lib/stellar/client) and IPFS layer so LiveInvoiceService's
 * read/write paths can be exercised without a real network, and assert that the
 * factory actually swaps implementations rather than always using mock data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnv = {
  NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
  NEXT_PUBLIC_IPFS_GATEWAY: "https://gateway.pinata.cloud/ipfs",
};

vi.mock("@/lib/env", () => ({ env: mockEnv }));

const getInvoice = vi.fn();
const mintInvoice = vi.fn();
const cancelInvoice = vi.fn();
const fundInvoice = vi.fn();
const repayInvoice = vi.fn();
const claimYield = vi.fn();
const getPositions = vi.fn();

vi.mock("@/lib/stellar/contracts", () => ({
  invoiceContract: { getInvoice, mintInvoice, cancelInvoice },
  marketplaceContract: { fundInvoice, repayInvoice, claimYield, getPositions },
}));

const submitTransaction = vi.fn();
const waitForTransaction = vi.fn();

vi.mock("@/lib/stellar/client", () => ({
  submitTransaction,
  waitForTransaction,
}));

vi.mock("@/lib/ipfs", () => ({
  uploadFileToPinata: vi.fn().mockResolvedValue("QmDocCid"),
  uploadInvoiceMetadata: vi.fn().mockResolvedValue("QmMetaCid"),
  isValidCID: vi.fn().mockReturnValue(true),
  fetchIpfsJsonWithFallback: vi.fn().mockResolvedValue({ raw: {} }),
  IpfsTamperError: class IpfsTamperError extends Error {},
  IpfsUnavailableError: class IpfsUnavailableError extends Error {},
}));

vi.mock("@/lib/security", () => ({
  sanitizeIpfsMetadata: vi.fn((data) => data),
}));

describe("createInvoiceService factory switch", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns a MockInvoiceService that resolves from local fixtures with no RPC calls", async () => {
    mockEnv.NEXT_PUBLIC_ENABLE_MOCK_DATA = true;
    const { createInvoiceService } = await import("../invoiceService");

    const service = createInvoiceService();
    const result = await service.getInvoices();

    expect(result.ok).toBe(true);
    expect(getInvoice).not.toHaveBeenCalled();
    expect(fundInvoice).not.toHaveBeenCalled();
  });

  it("returns a LiveInvoiceService that reads through the mocked RPC contract client", async () => {
    mockEnv.NEXT_PUBLIC_ENABLE_MOCK_DATA = false;
    getInvoice.mockResolvedValue({
      owner: "GOWNER",
      ipfs_cid: "QmCid",
      amount: 1_000_000n,
      financing_amount: 900_000n,
      discount_rate: 500,
      due_date: 1893456000n,
      status: 0,
    });

    const { createInvoiceService } = await import("../invoiceService");
    const service = createInvoiceService();

    const result = await service.getInvoice("inv_42", "GSOURCE");

    expect(getInvoice).toHaveBeenCalledWith(42n, "GSOURCE");
    expect(result.ok).toBe(true);
  });

  it("live getInvoice fails fast without a source public key, without hitting RPC", async () => {
    mockEnv.NEXT_PUBLIC_ENABLE_MOCK_DATA = false;
    const { createInvoiceService } = await import("../invoiceService");
    const service = createInvoiceService();

    const result = await service.getInvoice("inv_42");

    expect(result.ok).toBe(false);
    expect(getInvoice).not.toHaveBeenCalled();
  });

  it("routes live writes (mint/fund/repay) through the mocked contract clients", async () => {
    mockEnv.NEXT_PUBLIC_ENABLE_MOCK_DATA = false;
    mintInvoice.mockResolvedValue("unsigned-mint-xdr");
    fundInvoice.mockResolvedValue("unsigned-fund-xdr");
    repayInvoice.mockResolvedValue("unsigned-repay-xdr");

    const { createInvoiceService } = await import("../invoiceService");
    const service = createInvoiceService();

    const mintResult = await service.createInvoice(
      {
        document: new File(["x"], "invoice.pdf"),
        invoiceNumber: "INV-1",
        description: "test",
        debtorName: "Acme",
        debtorAddress: "GDEBTOR",
        amount: 1000,
        currency: "USDC",
        issueDate: "2026-01-01",
        dueDate: "2026-06-01",
        listingExpiryDate: "2026-05-01",
        jurisdiction: "US",
        category: "trade",
        discountRate: 0.05,
      } as any,
      "GOWNER"
    );
    expect(mintResult.ok).toBe(true);
    expect(mintInvoice).toHaveBeenCalledTimes(1);

    const fundResult = await service.fundInvoice("42", 500, "GINVESTOR");
    expect(fundResult.ok).toBe(true);
    expect(fundInvoice).toHaveBeenCalledWith(
      { tokenId: 42n, amount: 500_000_000n },
      "GINVESTOR"
    );

    const repayResult = await service.repayInvoice("42", "GOWNER");
    expect(repayResult.ok).toBe(true);
    expect(repayInvoice).toHaveBeenCalledWith({ tokenId: 42n }, "GOWNER");
  });

  it("mock writes never touch the RPC contract clients", async () => {
    mockEnv.NEXT_PUBLIC_ENABLE_MOCK_DATA = true;
    const { createInvoiceService } = await import("../invoiceService");
    const service = createInvoiceService();

    await service.fundInvoice("42", 500, "GINVESTOR");

    expect(fundInvoice).not.toHaveBeenCalled();
  });
});
