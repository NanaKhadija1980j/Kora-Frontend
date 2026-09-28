import type { Invoice, SMEProfile, InvestorProfile } from "@/types";

function seededRandom(seed: number) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

const jurisdictions = ["US", "EU", "UK", "NG", "KE", "GH", "ZA", "OTHER"] as const;
const categories = [
  "technology",
  "manufacturing",
  "logistics",
  "healthcare",
  "retail",
  "construction",
  "agriculture",
  "energy",
] as const;
const statuses = ["listed", "partially_funded", "fully_funded", "active", "repaid", "defaulted"] as const;
const riskTiers = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"] as const;

function pick<T>(rng: () => number, arr: readonly T[]) {
  return arr[Math.floor(rng() * arr.length)];
}

export function generateMockInvoices(count = 50, seed = 42): Invoice[] {
  const rng = seededRandom(seed);
  const invoices: Invoice[] = [];
  for (let i = 1; i <= count; i++) {
    const amount = Math.round((1000 + rng() * 499000));
    const financingPct = 0.5 + rng() * 0.45; // 50-95%
    const financingAmount = Math.round(amount * financingPct);
    const totalRaised = Math.round(financingAmount * rng());
    const fundingProgress = Math.min(1, totalRaised / financingAmount || 0);
    const inv: Invoice = {
      id: `inv_${String(i).padStart(3, "0")}`,
      tokenId: `${i}`,
      contractAddress: "CA-MOCK-CONTRACT",
      ipfsCid: `QmMock${i}`,
      metadata: {
        invoiceNumber: `INV-2025-${1000 + i}`,
        issuerName: `SME ${i}`,
        issuerAddress: `ADDR_${i}`,
        debtorName: `Debtor ${i}`,
        debtorAddress: `Debtor Address ${i}`,
        amount,
        currency: "USDC",
        issueDate: new Date(Date.now() - Math.floor(rng() * 60) * 24 * 3600 * 1000).toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + Math.floor(30 + rng() * 180) * 24 * 3600 * 1000).toISOString().slice(0, 10),
        description: `Invoice for ${pick(rng, categories)} services`,
        jurisdiction: pick(rng, jurisdictions) as any,
        category: pick(rng, categories) as any,
        documentHash: `QmMockDoc${i}`,
        documentUrl: `https://example.com/doc/${i}`,
      },
      terms: {
        discountRate: Number((0.02 + rng() * 0.12).toFixed(3)),
        apr: Number((10 + rng() * 40).toFixed(2)),
        financingAmount,
        minInvestment: Math.round(100 + rng() * 10000),
        maxInvestment: Math.round(1000 + rng() * 200000),
        tenor: Math.round(30 + rng() * 360),
        repaymentDate: new Date(Date.now() + Math.round(30 + rng() * 360) * 24 * 3600 * 1000).toISOString().slice(0, 10),
      },
      funding: {
        totalRaised,
        targetAmount: financingAmount,
        fundingProgress,
        investorCount: Math.max(0, Math.round(rng() * 120)),
        remainingCapacity: Math.max(0, financingAmount - totalRaised),
      },
      riskTier: pick(rng, riskTiers) as any,
      riskScore: Math.round(30 + rng() * 70),
      debtorPrivacy: "full",
      status: pick(rng, statuses) as any,
      createdAt: new Date(Date.now() - Math.round(rng() * 90) * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      ownerAddress: `WALLET_SME_${Math.ceil(rng() * 10)}`,
    };
    invoices.push(inv);
  }
  return invoices;
}

export function generateSMEProfiles(count = 10, invoices: Invoice[], seed = 101): SMEProfile[] {
  const rng = seededRandom(seed);
  const profiles: SMEProfile[] = [];
  for (let i = 1; i <= count; i++) {
    const myInv = invoices.filter((inv) => inv.ownerAddress === `WALLET_SME_${i}`);
    const totalFinanced = myInv.reduce((s, inv) => s + inv.funding.totalRaised, 0);
    profiles.push({
      id: `sme_${i}`,
      walletAddress: `WALLET_SME_${i}`,
      role: "sme",
      displayName: `SME ${i}`,
      companyName: `SME Company ${i}`,
      email: `sme${i}@example.com`,
      kycStatus: "verified",
      createdAt: new Date(Date.now() - Math.round(rng() * 400) * 24 * 3600 * 1000).toISOString(),
      jurisdiction: pick(rng, jurisdictions) as any,
      totalInvoicesCreated: myInv.length,
      totalFinanced,
      repaymentRate: Number((0.8 + rng() * 0.2).toFixed(2)),
    });
  }
  return profiles;
}

export function generateInvestorProfiles(count = 10, invoices: Invoice[], seed = 202): InvestorProfile[] {
  const rng = seededRandom(seed);
  const profiles: InvestorProfile[] = [];
  for (let i = 1; i <= count; i++) {
    const positions = [] as any[];
    const investCount = Math.max(1, Math.round(rng() * 12));
    let totalInvested = 0;
    for (let j = 0; j < investCount; j++) {
      const inv = invoices[Math.floor(rng() * invoices.length)];
      const amt = Math.round(Math.min(inv.funding.targetAmount - inv.funding.totalRaised, 1000 + rng() * 50000));
      totalInvested += Math.abs(amt);
      positions.push({ invoiceId: inv.id, investedAmount: Math.max(100, Math.round(amt)) });
    }
    profiles.push({
      id: `inv_${i}`,
      walletAddress: `WALLET_INV_${i}`,
      role: "investor",
      displayName: `Investor ${i}`,
      companyName: `Investor ${i}`,
      email: `investor${i}@example.com`,
      kycStatus: "verified",
      createdAt: new Date(Date.now() - Math.round(rng() * 700) * 24 * 3600 * 1000).toISOString(),
      totalInvested,
      totalYieldEarned: Math.round(totalInvested * (0.02 + rng() * 0.12)),
      activePositions: positions.length,
      portfolioValue: totalInvested,
    });
  }
  return profiles;
}

export function generateTransactions(count = 100, invoices: Invoice[], seed = 303) {
  const rng = seededRandom(seed);
  const types = ["mint", "fund", "repay", "claim"];
  const transactions: any[] = [];
  for (let i = 0; i < count; i++) {
    const inv = invoices[Math.floor(rng() * invoices.length)];
    const type = pick(rng, types as any);
    const amount = Math.round((type === "fund" ? (100 + rng() * Math.min(50000, inv.metadata.amount)) : rng() * 10000));
    transactions.push({
      hash: `tx_${i}_${Math.round(rng() * 1e6)}`,
      type,
      status: rng() > 0.05 ? "confirmed" : "failed",
      invoiceNumber: inv.metadata.invoiceNumber,
      amount,
      currency: inv.metadata.currency,
      description: `${type} for ${inv.metadata.invoiceNumber}`,
      timestamp: new Date(Date.now() - Math.round(rng() * 90) * 24 * 3600 * 1000).toISOString(),
    });
  }
  return transactions;
}

export function generateAnalyticsSeries(days = 90, seed = 404) {
  const rng = seededRandom(seed);
  const now = new Date();
  const portfolio: { date: string; value: number }[] = [];
  const yieldSeries: { date: string; value: number }[] = [];
  const volume: { date: string; value: number }[] = [];
  let base = 1000000 + rng() * 500000;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    base = Math.max(50000, base + (rng() - 0.45) * 20000);
    const val = Math.round(base);
    portfolio.push({ date: d.toISOString().slice(0, 10), value: val });
    yieldSeries.push({ date: d.toISOString().slice(0, 10), value: Math.round((rng() * 5000)) });
    volume.push({ date: d.toISOString().slice(0, 10), value: Math.round(rng() * 200000) });
  }
  return { portfolio, yieldSeries, volume };
}

// Exports — generate with deterministic seeds so tests are stable
export const MOCK_INVOICES: Invoice[] = [
  {
    id: "inv_001",
    tokenId: "1",
    contractAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    ipfsCid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    metadata: {
      invoiceNumber: "INV-2024-0891",
      issuerName: "TechBridge Solutions Ltd",
      issuerAddress: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
      debtorName: "Safaricom PLC",
      debtorAddress: "Safaricom House, Waiyaki Way, Nairobi, Kenya",
      amount: 250000,
      currency: "USDC",
      issueDate: "2024-11-01",
      dueDate: "2025-02-01",
      description: "Enterprise software development services Q4 2024",
      jurisdiction: "KE",
      category: "technology",
      documentHash: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      documentUrl: "https://gateway.pinata.cloud/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    },
    terms: {
      discountRate: 0.06,
      apr: 24.5,
      financingAmount: 235000,
      minInvestment: 1000,
      maxInvestment: 50000,
      tenor: 92,
      repaymentDate: "2025-02-01",
    },
    funding: {
      totalRaised: 188000,
      targetAmount: 235000,
      fundingProgress: 0.8,
      investorCount: 14,
      remainingCapacity: 47000,
    },
    riskTier: "A",
    riskScore: 78,
    debtorPrivacy: "full",
    status: "partially_funded",
    createdAt: "2024-11-05T10:30:00Z",
    updatedAt: "2024-11-20T14:22:00Z",
    ownerAddress: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
    txHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  },
  {
    id: "inv_002",
    tokenId: "2",
    contractAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    ipfsCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    metadata: {
      invoiceNumber: "INV-2024-1102",
      issuerName: "AgriFlow Exports Ghana",
      issuerAddress: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      debtorName: "Olam International",
      debtorAddress: "9 Temasek Boulevard, Singapore",
      amount: 500000,
      currency: "USDC",
      issueDate: "2024-10-15",
      dueDate: "2025-01-15",
      description: "Cocoa export shipment — 200MT, Q4 2024",
      jurisdiction: "GH",
      category: "agriculture",
      documentHash: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
      documentUrl: "https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    },
    terms: {
      discountRate: 0.04,
      apr: 18.2,
      financingAmount: 480000,
      minInvestment: 5000,
      maxInvestment: 100000,
      tenor: 92,
      repaymentDate: "2025-01-15",
    },
    funding: {
      totalRaised: 480000,
      targetAmount: 480000,
      fundingProgress: 1.0,
      investorCount: 22,
      remainingCapacity: 0,
    },
    riskTier: "AA",
    riskScore: 88,
    debtorPrivacy: "partial",
    status: "fully_funded",
    createdAt: "2024-10-18T08:00:00Z",
    updatedAt: "2024-10-30T16:45:00Z",
    ownerAddress: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    txHash: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
  },
  {
    id: "inv_003",
    tokenId: "3",
    contractAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    ipfsCid: "QmZTR5amvZuri3Nf7FcdksPghyheBVGRL9hHABs9DKWJLH",
    metadata: {
      invoiceNumber: "INV-2024-0445",
      issuerName: "MediSupply Nigeria",
      issuerAddress: "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
      debtorName: "Lagos State Ministry of Health",
      debtorAddress: "Secretariat, Alausa, Ikeja, Lagos",
      amount: 120000,
      currency: "USDC",
      issueDate: "2024-11-10",
      dueDate: "2025-03-10",
      description: "Medical equipment supply — Q4 2024 batch",
      jurisdiction: "NG",
      category: "healthcare",
      documentHash: "QmZTR5amvZuri3Nf7FcdksPghyheBVGRL9hHABs9DKWJLH",
      documentUrl: "https://gateway.pinata.cloud/ipfs/QmZTR5amvZuri3Nf7FcdksPghyheBVGRL9hHABs9DKWJLH",
    },
    terms: {
      discountRate: 0.08,
      apr: 32.1,
      financingAmount: 110400,
      minInvestment: 500,
      maxInvestment: 25000,
      tenor: 120,
      repaymentDate: "2025-03-10",
    },
    funding: {
      totalRaised: 0,
      targetAmount: 110400,
      fundingProgress: 0,
      investorCount: 0,
      remainingCapacity: 110400,
    },
    riskTier: "BBB",
    riskScore: 62,
    debtorPrivacy: "anonymized",
    status: "listed",
    createdAt: "2024-11-12T12:00:00Z",
    updatedAt: "2024-11-18T09:10:00Z",
    ownerAddress: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
  },
  {
    id: "inv_004",
    tokenId: "4",
    contractAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    ipfsCid: "QmPZ9gcCEpqKTo9ikXiSYSCiB1nAmNH2AAAA",
    metadata: {
      invoiceNumber: "INV-2024-2201",
      issuerName: "BuildRight Construction SA",
      issuerAddress: "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      debtorName: "Transnet SOC Ltd",
      debtorAddress: "Carlton Centre, 150 Commissioner St, Johannesburg",
      amount: 1200000,
      currency: "USDC",
      issueDate: "2024-09-01",
      dueDate: "2025-01-01",
      description: "Infrastructure civil works — Phase 2 completion",
      jurisdiction: "ZA",
      category: "construction",
      documentHash: "QmPZ9gcCEpqKTo9ikXiSYSCiB1nAmNH2AAAA",
      documentUrl: "https://gateway.pinata.cloud/ipfs/QmPZ9gcCEpqKTo9ikXiSYSCiB1nAmNH2AAAA",
    },
    terms: {
      discountRate: 0.035,
      apr: 15.8,
      financingAmount: 1158000,
      minInvestment: 10000,
      maxInvestment: 250000,
      tenor: 122,
      repaymentDate: "2025-01-01",
    },
    funding: {
      totalRaised: 694800,
      targetAmount: 1158000,
      fundingProgress: 0.6,
      investorCount: 31,
      remainingCapacity: 463200,
    },
    riskTier: "AA",
    riskScore: 85,
    debtorPrivacy: "full",
    status: "partially_funded",
    createdAt: "2024-09-05T07:30:00Z",
    updatedAt: "2024-11-15T11:00:00Z",
    ownerAddress: "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
    txHash: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  },
  {
    id: "inv_005",
    tokenId: "5",
    contractAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    ipfsCid: "QmQPeNsJPyVWPFDVHb77w8G42Fvo7HvabiYJCZtwpaAAAA",
    metadata: {
      invoiceNumber: "INV-2024-0078",
      issuerName: "SolarGrid Energy Ltd",
      issuerAddress: "GFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
      debtorName: "Kenya Power & Lighting Co.",
      debtorAddress: "Stima Plaza, Kolobot Road, Nairobi",
      amount: 750000,
      currency: "USDC",
      issueDate: "2024-11-01",
      dueDate: "2025-04-01",
      description: "Solar panel installation — 5MW rural electrification project",
      jurisdiction: "KE",
      category: "energy",
      documentHash: "QmQPeNsJPyVWPFDVHb77w8G42Fvo7HvabiYJCZtwpaAAAA",
      documentUrl: "https://gateway.pinata.cloud/ipfs/QmQPeNsJPyVWPFDVHb77w8G42Fvo7HvabiYJCZtwpaAAAA",
    },
    terms: {
      discountRate: 0.045,
      apr: 21.3,
      financingAmount: 716250,
      minInvestment: 2500,
      maxInvestment: 150000,
      tenor: 151,
      repaymentDate: "2025-04-01",
    },
    funding: {
      totalRaised: 0,
      targetAmount: 716250,
      fundingProgress: 0,
      investorCount: 0,
      remainingCapacity: 716250,
    },
    riskTier: "A",
    riskScore: 74,
    debtorPrivacy: "anonymized",
    status: "listed",
    createdAt: "2024-11-03T09:00:00Z",
    updatedAt: "2024-11-19T13:30:00Z",
    ownerAddress: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
  },
  ...generateMockInvoices(95, 999).map((inv, idx) => {
    const num = idx + 6;
    return {
      ...inv,
      id: `inv_${String(num).padStart(3, "0")}`,
      tokenId: String(num),
      metadata: {
        ...inv.metadata,
        invoiceNumber: `INV-2025-${1000 + num}`,
        issuerName: `SME ${num}`,
        issuerAddress: `ADDR_${num}`,
        debtorName: `Debtor ${num}`,
        debtorAddress: `Debtor Address ${num}`,
      },
    };
  }),
];
export const MOCK_SMES = generateSMEProfiles(10, MOCK_INVOICES, 222);
export const MOCK_INVESTORS = generateInvestorProfiles(10, MOCK_INVOICES, 333);
export const MOCK_TRANSACTIONS = generateTransactions(100, MOCK_INVOICES, 444);
export const MOCK_ANALYTICS = generateAnalyticsSeries(90, 555);

export const MOCK_STATS = {
  totalVolumeFinanced: 48_200_000,
  activeInvoices: 127,
  totalInvestors: 843,
  averageApr: 22.4,
  defaultRate: 0.8,
  totalSMEs: 312,
};
