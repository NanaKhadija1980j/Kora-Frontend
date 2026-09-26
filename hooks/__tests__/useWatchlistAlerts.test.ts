import { describe, it, expect, vi } from "vitest";
import { getAlertMessage } from "@/hooks/useWatchlistAlerts";
import type { NotificationPreferences } from "@/store/invoiceStore";
import type { Invoice } from "@/types";

// getAlertMessage is pure, but its module imports `@/store`, which pulls in
// walletStore → lib/env. Mock the env module so the suite loads without the
// real NEXT_PUBLIC_* config.
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  },
}));

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_1",
    tokenId: "1",
    contractAddress: "C...",
    ipfsCid: "QmTest",
    metadata: {
      invoiceNumber: "INV-001",
      issuerName: "Test Co",
      issuerAddress: "G...",
      debtorName: "Debtor Inc",
      debtorAddress: "123 St",
      amount: 10000,
      currency: "USDC",
      issueDate: "2025-01-01",
      dueDate: "2025-06-01",
      description: "Test",
      jurisdiction: "US",
      category: "technology",
      documentHash: "QmTest",
      documentUrl: "https://ipfs.io/ipfs/QmTest",
    },
    terms: {
      discountRate: 0.05,
      apr: 20,
      financingAmount: 9500,
      minInvestment: 100,
      maxInvestment: 5000,
      tenor: 90,
      repaymentDate: "2025-06-01",
    },
    funding: {
      totalRaised: 0,
      targetAmount: 9500,
      fundingProgress: 0.5,
      investorCount: 0,
      remainingCapacity: 9500,
    },
    riskTier: "A",
    riskScore: 75,
    status: "listed",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ownerAddress: "G...",
    ...overrides,
  } as Invoice;
}

const ALL_ON: NotificationPreferences = {
  status: true,
  fundingProgress: true,
  apr: true,
};

const ALL_OFF: NotificationPreferences = {
  status: false,
  fundingProgress: false,
  apr: false,
};

describe("getAlertMessage", () => {
  it("returns null when there is no previous snapshot", () => {
    const invoice = makeInvoice();
    expect(getAlertMessage(invoice, undefined, ALL_ON)).toBeNull();
  });

  it("returns a status message when the invoice status changed", () => {
    const invoice = makeInvoice({ status: "fully_funded" });
    const message = getAlertMessage(invoice, { status: "listed", fundingProgress: 0.5, apr: 20 }, ALL_ON);

    expect(message).toBe("INV-001 is now fully funded.");
  });

  it("skips the status branch when the status preference is disabled", () => {
    const invoice = makeInvoice({ status: "fully_funded" });
    const previous = { status: "listed", fundingProgress: 0.5, apr: 20 };
    const preferences: NotificationPreferences = { ...ALL_OFF, status: false };

    expect(getAlertMessage(invoice, previous, preferences)).toBeNull();
  });

  it("returns a funding message when funding progress changed", () => {
    const invoice = makeInvoice({ funding: { ...makeInvoice().funding, fundingProgress: 0.75 } });
    const message = getAlertMessage(invoice, { status: "listed", fundingProgress: 0.5, apr: 20 }, ALL_ON);

    expect(message).toBe("INV-001 funding reached 75%.");
  });

  it("rounds the funding percentage to a whole number", () => {
    const invoice = makeInvoice({ funding: { ...makeInvoice().funding, fundingProgress: 0.666 } });
    const message = getAlertMessage(invoice, { status: "listed", fundingProgress: 0.5, apr: 20 }, ALL_ON);

    expect(message).toBe("INV-001 funding reached 67%.");
  });

  it("skips the funding branch when the funding preference is disabled", () => {
    const invoice = makeInvoice({ funding: { ...makeInvoice().funding, fundingProgress: 0.75 } });
    const previous = { status: "listed", fundingProgress: 0.5, apr: 20 };
    const preferences: NotificationPreferences = { ...ALL_OFF, fundingProgress: false };

    expect(getAlertMessage(invoice, previous, preferences)).toBeNull();
  });

  it("returns an APR message when the APR changed", () => {
    const invoice = makeInvoice({ terms: { ...makeInvoice().terms, apr: 25 } });
    const message = getAlertMessage(invoice, { status: "listed", fundingProgress: 0.5, apr: 20 }, ALL_ON);

    expect(message).toBe("INV-001 APR changed to 25%.");
  });

  it("skips the APR branch when the APR preference is disabled", () => {
    const invoice = makeInvoice({ terms: { ...makeInvoice().terms, apr: 25 } });
    const previous = { status: "listed", fundingProgress: 0.5, apr: 20 };
    const preferences: NotificationPreferences = { ...ALL_OFF, apr: false };

    expect(getAlertMessage(invoice, previous, preferences)).toBeNull();
  });

  it("prioritises the status change over funding and APR changes", () => {
    const invoice = makeInvoice({
      status: "repaid",
      funding: { ...makeInvoice().funding, fundingProgress: 1 },
      terms: { ...makeInvoice().terms, apr: 30 },
    });
    const message = getAlertMessage(invoice, { status: "listed", fundingProgress: 0.5, apr: 20 }, ALL_ON);

    expect(message).toBe("INV-001 is now repaid.");
  });

  it("returns null when nothing has changed", () => {
    const invoice = makeInvoice();
    const message = getAlertMessage(invoice, { status: "listed", fundingProgress: 0.5, apr: 20 }, ALL_ON);

    expect(message).toBeNull();
  });
});
