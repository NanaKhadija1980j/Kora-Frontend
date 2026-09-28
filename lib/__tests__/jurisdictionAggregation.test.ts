/**
 * lib/__tests__/jurisdictionAggregation.test.ts
 *
 * Unit tests for aggregateByJurisdiction (lib/utils.ts).
 *
 * Covers:
 * - Empty input
 * - Single invoice
 * - Multi-invoice aggregation per key
 * - avgApr calculation
 * - activeCount (listed / partially_funded)
 * - Sort order (descending totalAmount)
 * - Unknown / OTHER jurisdiction passthrough
 * - Immutability (original array unchanged)
 */

import { describe, it, expect } from "vitest";
import { aggregateByJurisdiction } from "../utils";
import type { Invoice } from "@/types";

// ─── Fixture factory ──────────────────────────────────────────────────────────

function makeInvoice(
  overrides: Partial<Invoice> & {
    jurisdiction?: string;
    amount?: number;
    apr?: number;
    status?: Invoice["status"];
  } = {}
): Invoice {
  return {
    id: overrides.id ?? "inv_test",
    tokenId: "1",
    contractAddress: "C...",
    ipfsCid: "Qm...",
    metadata: {
      invoiceNumber: "INV-001",
      issuerName: "Test Co",
      issuerAddress: "G...",
      debtorName: "Debtor Inc",
      debtorAddress: "123 St",
      amount: overrides.amount ?? 100_000,
      currency: "USDC",
      issueDate: "2025-01-01",
      dueDate: "2025-06-01",
      description: "Test",
      jurisdiction: (overrides.jurisdiction as any) ?? "US",
      category: "technology",
      documentHash: "Qm...",
      documentUrl: "https://ipfs.io/ipfs/Qm...",
    },
    terms: {
      discountRate: 0.05,
      apr: overrides.apr ?? 20,
      financingAmount: 95_000,
      minInvestment: 1_000,
      maxInvestment: 50_000,
      tenor: 90,
      repaymentDate: "2025-06-01",
    },
    funding: {
      totalRaised: 50_000,
      targetAmount: 95_000,
      fundingProgress: 0.53,
      investorCount: 5,
      remainingCapacity: 45_000,
    },
    riskTier: "A",
    riskScore: 75,
    status: overrides.status ?? "listed",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ownerAddress: "G...",
    ...overrides,
  } as Invoice;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("aggregateByJurisdiction", () => {
  // ── Empty / trivial ────────────────────────────────────────────────────────

  it("returns an empty array for an empty invoice list", () => {
    expect(aggregateByJurisdiction([])).toHaveLength(0);
  });

  it("does not mutate the input array", () => {
    const invoices = [makeInvoice({ id: "a", jurisdiction: "KE" })];
    const original = [...invoices];
    aggregateByJurisdiction(invoices);
    expect(invoices).toEqual(original);
  });

  // ── Single invoice ─────────────────────────────────────────────────────────

  it("returns one entry for a single invoice", () => {
    const result = aggregateByJurisdiction([
      makeInvoice({ id: "s1", jurisdiction: "KE", amount: 50_000, apr: 20 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].jurisdiction).toBe("KE");
    expect(result[0].count).toBe(1);
    expect(result[0].totalAmount).toBe(50_000);
    expect(result[0].avgApr).toBeCloseTo(20, 5);
  });

  // ── Count ──────────────────────────────────────────────────────────────────

  it("counts multiple invoices per jurisdiction correctly", () => {
    const invoices = [
      makeInvoice({ id: "c1", jurisdiction: "NG" }),
      makeInvoice({ id: "c2", jurisdiction: "NG" }),
      makeInvoice({ id: "c3", jurisdiction: "NG" }),
      makeInvoice({ id: "c4", jurisdiction: "KE" }),
    ];
    const result = aggregateByJurisdiction(invoices);
    const ng = result.find((r) => r.jurisdiction === "NG")!;
    const ke = result.find((r) => r.jurisdiction === "KE")!;
    expect(ng.count).toBe(3);
    expect(ke.count).toBe(1);
  });

  // ── totalAmount ────────────────────────────────────────────────────────────

  it("sums invoice amounts correctly", () => {
    const invoices = [
      makeInvoice({ id: "a1", jurisdiction: "ZA", amount: 100_000 }),
      makeInvoice({ id: "a2", jurisdiction: "ZA", amount: 250_000 }),
      makeInvoice({ id: "a3", jurisdiction: "ZA", amount: 50_000 }),
    ];
    const result = aggregateByJurisdiction(invoices);
    expect(result[0].totalAmount).toBe(400_000);
  });

  // ── avgApr ─────────────────────────────────────────────────────────────────

  it("computes average APR correctly", () => {
    const invoices = [
      makeInvoice({ id: "p1", jurisdiction: "GH", apr: 10 }),
      makeInvoice({ id: "p2", jurisdiction: "GH", apr: 20 }),
      makeInvoice({ id: "p3", jurisdiction: "GH", apr: 30 }),
    ];
    const result = aggregateByJurisdiction(invoices);
    expect(result[0].avgApr).toBeCloseTo(20, 5);
  });

  it("returns avgApr of 0 when count is 0 (defensive)", () => {
    // This path is only reachable if the map has an entry with count=0,
    // which cannot happen through normal input; we test the formula branch
    // indirectly: a single-invoice aggregation with APR 0 should return 0.
    const result = aggregateByJurisdiction([
      makeInvoice({ id: "z", jurisdiction: "US", apr: 0 }),
    ]);
    expect(result[0].avgApr).toBe(0);
  });

  // ── activeCount ────────────────────────────────────────────────────────────

  it("counts only listed and partially_funded as active", () => {
    const invoices = [
      makeInvoice({ id: "ac1", jurisdiction: "EU", status: "listed" }),
      makeInvoice({ id: "ac2", jurisdiction: "EU", status: "partially_funded" }),
      makeInvoice({ id: "ac3", jurisdiction: "EU", status: "fully_funded" }),
      makeInvoice({ id: "ac4", jurisdiction: "EU", status: "repaid" }),
      makeInvoice({ id: "ac5", jurisdiction: "EU", status: "defaulted" }),
    ];
    const result = aggregateByJurisdiction(invoices);
    expect(result[0].activeCount).toBe(2);
    expect(result[0].count).toBe(5);
  });

  it("returns activeCount 0 when all invoices are non-active", () => {
    const invoices = [
      makeInvoice({ id: "na1", jurisdiction: "UK", status: "repaid" }),
      makeInvoice({ id: "na2", jurisdiction: "UK", status: "cancelled" }),
    ];
    const result = aggregateByJurisdiction(invoices);
    expect(result[0].activeCount).toBe(0);
  });

  // ── Sort order ─────────────────────────────────────────────────────────────

  it("sorts results by totalAmount descending", () => {
    const invoices = [
      makeInvoice({ id: "s1", jurisdiction: "KE", amount:  50_000 }),
      makeInvoice({ id: "s2", jurisdiction: "ZA", amount: 500_000 }),
      makeInvoice({ id: "s3", jurisdiction: "NG", amount: 200_000 }),
      makeInvoice({ id: "s4", jurisdiction: "GH", amount:   1_000 }),
    ];
    const result = aggregateByJurisdiction(invoices);
    const amounts = result.map((r) => r.totalAmount);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it("places the highest-volume jurisdiction first", () => {
    const invoices = [
      makeInvoice({ id: "hv1", jurisdiction: "NG", amount: 1_000_000 }),
      makeInvoice({ id: "hv2", jurisdiction: "KE", amount: 500_000 }),
    ];
    const result = aggregateByJurisdiction(invoices);
    expect(result[0].jurisdiction).toBe("NG");
  });

  // ── Multiple jurisdictions ─────────────────────────────────────────────────

  it("produces one entry per distinct jurisdiction", () => {
    const invoices = [
      makeInvoice({ id: "m1", jurisdiction: "US" }),
      makeInvoice({ id: "m2", jurisdiction: "EU" }),
      makeInvoice({ id: "m3", jurisdiction: "UK" }),
      makeInvoice({ id: "m4", jurisdiction: "US" }),
    ];
    const result = aggregateByJurisdiction(invoices);
    expect(result).toHaveLength(3);
    const codes = result.map((r) => r.jurisdiction);
    expect(codes).toContain("US");
    expect(codes).toContain("EU");
    expect(codes).toContain("UK");
  });

  // ── OTHER jurisdiction passthrough ─────────────────────────────────────────

  it("passes through OTHER jurisdiction without error", () => {
    const invoices = [
      makeInvoice({ id: "o1", jurisdiction: "OTHER", amount: 75_000 }),
    ];
    const result = aggregateByJurisdiction(invoices);
    expect(result[0].jurisdiction).toBe("OTHER");
    expect(result[0].count).toBe(1);
    expect(result[0].totalAmount).toBe(75_000);
  });

  // ── Result shape ───────────────────────────────────────────────────────────

  it("each result entry has the correct shape", () => {
    const result = aggregateByJurisdiction([
      makeInvoice({ id: "sh1", jurisdiction: "KE" }),
    ]);
    expect(result[0]).toMatchObject({
      jurisdiction: expect.any(String),
      count: expect.any(Number),
      totalAmount: expect.any(Number),
      avgApr: expect.any(Number),
      activeCount: expect.any(Number),
    });
  });

  // ── Large uniform dataset ──────────────────────────────────────────────────

  it("handles a large uniform dataset without error", () => {
    const invoices = Array.from({ length: 100 }, (_, i) =>
      makeInvoice({
        id: `bulk_${i}`,
        jurisdiction: ["KE", "NG", "GH", "ZA", "US"][i % 5],
        amount: 10_000 + i * 1_000,
        apr: 10 + (i % 30),
        status: i % 3 === 0 ? "listed" : "fully_funded",
      })
    );
    const result = aggregateByJurisdiction(invoices);
    expect(result).toHaveLength(5);
    const totalCount = result.reduce((s, r) => s + r.count, 0);
    expect(totalCount).toBe(100);
  });
});
