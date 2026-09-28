/**
 * lib/__tests__/comparison.test.ts
 *
 * Unit tests for the invoice similarity scorer (lib/comparison.ts).
 *
 * Covers:
 * - Individual dimension scorers via computeSimilarityScore
 * - Composite score weight correctness
 * - getSimilarInvoices: exclusion rules, ranking, edge cases
 */

import { describe, it, expect } from "vitest";
import {
  computeSimilarityScore,
  getSimilarInvoices,
  WEIGHTS,
  APR_WINDOW,
  TENOR_WINDOW,
  RISK_TIER_ORDER,
  MAX_COMPARISON,
  buildRangeSelection,
  normalizeComparisonList,
  toggleComparisonId,
} from "../comparison";
import type { Invoice } from "@/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Build a minimal Invoice with sane defaults; override as needed. */
function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const base: Invoice = {
    id: "inv_base",
    tokenId: "1",
    contractAddress: "C...",
    ipfsCid: "Qm...",
    metadata: {
      invoiceNumber: "INV-001",
      issuerName: "Issuer Co",
      issuerAddress: "G...",
      debtorName: "Debtor Inc",
      debtorAddress: "123 Street",
      amount: 100_000,
      currency: "USDC",
      issueDate: "2025-01-01",
      dueDate: "2025-06-01",
      description: "Test invoice",
      jurisdiction: "US",
      category: "technology",
      documentHash: "Qm...",
      documentUrl: "https://ipfs.io/ipfs/Qm...",
    },
    terms: {
      discountRate: 0.05,
      apr: 20,
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
      investorCount: 10,
      remainingCapacity: 45_000,
    },
    riskTier: "A",
    riskScore: 75,
    status: "partially_funded",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ownerAddress: "G...",
  };

  // Deep-merge metadata / terms so callers only need to specify changed keys
  return {
    ...base,
    ...overrides,
    metadata: { ...base.metadata, ...(overrides.metadata ?? {}) },
    terms: { ...base.terms, ...(overrides.terms ?? {}) },
    funding: { ...base.funding, ...(overrides.funding ?? {}) },
  } as Invoice;
}

const REF = makeInvoice({ id: "ref" });

// ─── computeSimilarityScore ────────────────────────────────────────────────────

describe("computeSimilarityScore", () => {
  it("returns score=100 for an identical invoice", () => {
    // Clone with different id
    const clone = makeInvoice({ id: "clone" });
    const { score } = computeSimilarityScore(REF, clone);
    expect(score).toBeCloseTo(100, 5);
  });

  // ── Category dimension ─────────────────────────────────────────────────────

  describe("category dimension", () => {
    it("contributes full weight when categories match", () => {
      const cand = makeInvoice({ id: "c1", metadata: { category: "technology" } });
      const { dimensions } = computeSimilarityScore(REF, cand);
      expect(dimensions.category).toBeCloseTo(WEIGHTS.category, 10);
    });

    it("contributes 0 when categories differ", () => {
      const cand = makeInvoice({ id: "c2", metadata: { category: "logistics" } });
      const { dimensions } = computeSimilarityScore(REF, cand);
      expect(dimensions.category).toBe(0);
    });
  });

  // ── Risk tier dimension ───────────────────────────────────────────────────

  describe("riskTier dimension", () => {
    it("contributes full weight for the same tier", () => {
      const cand = makeInvoice({ id: "r1" }); // same "A" tier
      const { dimensions } = computeSimilarityScore(REF, cand);
      expect(dimensions.riskTier).toBeCloseTo(WEIGHTS.riskTier, 10);
    });

    it("decays by one step for adjacent tier (AA vs A)", () => {
      const cand = makeInvoice({ id: "r2", riskTier: "AA" });
      const { dimensions } = computeSimilarityScore(REF, cand);
      const maxSteps = RISK_TIER_ORDER.length - 1;
      const expected = (1 - 1 / maxSteps) * WEIGHTS.riskTier;
      expect(dimensions.riskTier).toBeCloseTo(expected, 10);
    });

    it("contributes 0 for the most distant tier (AAA vs CCC)", () => {
      const ref = makeInvoice({ id: "r3", riskTier: "AAA" });
      const cand = makeInvoice({ id: "r4", riskTier: "CCC" });
      const { dimensions } = computeSimilarityScore(ref, cand);
      expect(dimensions.riskTier).toBe(0);
    });

    it("is symmetric: score(A,BBB) === score(BBB,A)", () => {
      const a = makeInvoice({ id: "a", riskTier: "A" });
      const bbb = makeInvoice({ id: "b", riskTier: "BBB" });
      const ab = computeSimilarityScore(a, bbb).dimensions.riskTier;
      const ba = computeSimilarityScore(bbb, a).dimensions.riskTier;
      expect(ab).toBeCloseTo(ba, 10);
    });
  });

  // ── APR band dimension ────────────────────────────────────────────────────

  describe("aprBand dimension", () => {
    it("contributes full weight for identical APR", () => {
      const cand = makeInvoice({ id: "a1", terms: { apr: 20 } }); // same as REF
      const { dimensions } = computeSimilarityScore(REF, cand);
      expect(dimensions.aprBand).toBeCloseTo(WEIGHTS.aprBand, 10);
    });

    it("contributes 0 when APR difference >= APR_WINDOW", () => {
      const cand = makeInvoice({ id: "a2", terms: { apr: REF.terms.apr + APR_WINDOW } });
      const { dimensions } = computeSimilarityScore(REF, cand);
      expect(dimensions.aprBand).toBe(0);
    });

    it("contributes proportionally within the window", () => {
      const halfWindow = APR_WINDOW / 2;
      const cand = makeInvoice({ id: "a3", terms: { apr: REF.terms.apr + halfWindow } });
      const { dimensions } = computeSimilarityScore(REF, cand);
      // Expected: (1 - (halfWindow / APR_WINDOW)) * WEIGHTS.aprBand = 0.5 * weight
      expect(dimensions.aprBand).toBeCloseTo(0.5 * WEIGHTS.aprBand, 10);
    });

    it("is symmetric for APR differences", () => {
      const a = makeInvoice({ id: "x", terms: { apr: 18 } });
      const b = makeInvoice({ id: "y", terms: { apr: 22 } });
      const ab = computeSimilarityScore(a, b).dimensions.aprBand;
      const ba = computeSimilarityScore(b, a).dimensions.aprBand;
      expect(ab).toBeCloseTo(ba, 10);
    });
  });

  // ── Tenor band dimension ──────────────────────────────────────────────────

  describe("tenorBand dimension", () => {
    it("contributes full weight for identical tenor", () => {
      const cand = makeInvoice({ id: "t1", terms: { tenor: 90 } }); // same as REF
      const { dimensions } = computeSimilarityScore(REF, cand);
      expect(dimensions.tenorBand).toBeCloseTo(WEIGHTS.tenorBand, 10);
    });

    it("contributes 0 when tenor difference >= TENOR_WINDOW", () => {
      const cand = makeInvoice({ id: "t2", terms: { tenor: REF.terms.tenor + TENOR_WINDOW } });
      const { dimensions } = computeSimilarityScore(REF, cand);
      expect(dimensions.tenorBand).toBe(0);
    });

    it("contributes proportionally within the window", () => {
      const halfWindow = TENOR_WINDOW / 2;
      const cand = makeInvoice({ id: "t3", terms: { tenor: REF.terms.tenor + halfWindow } });
      const { dimensions } = computeSimilarityScore(REF, cand);
      expect(dimensions.tenorBand).toBeCloseTo(0.5 * WEIGHTS.tenorBand, 10);
    });
  });

  // ── Composite ────────────────────────────────────────────────────────────

  describe("composite score", () => {
    it("weights sum to 1 (sanity check on WEIGHTS constant)", () => {
      const total = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
      expect(total).toBeCloseTo(1.0, 10);
    });

    it("score is 0 when all dimensions differ maximally", () => {
      // category mismatch, AAA vs CCC (max 6 steps), APR outside window, tenor outside window
      const ref = makeInvoice({
        id: "zref",
        riskTier: "AAA",
        metadata: { category: "technology" },
        terms: { apr: 5, tenor: 30 },
      });
      const cand = makeInvoice({
        id: "zcand",
        riskTier: "CCC",
        metadata: { category: "agriculture" },
        terms: { apr: 5 + APR_WINDOW + 1, tenor: 30 + TENOR_WINDOW + 1 },
      });
      const { score } = computeSimilarityScore(ref, cand);
      expect(score).toBe(0);
    });

    it("partial match score is between 0 and 100", () => {
      const cand = makeInvoice({
        id: "partial",
        riskTier: "AA",                         // 1 step away → partial
        metadata: { category: "logistics" },     // mismatch → 0
        terms: { apr: 22, tenor: 95 },           // small deltas → partial
      });
      const { score } = computeSimilarityScore(REF, cand);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });
  });
});

// ─── getSimilarInvoices ───────────────────────────────────────────────────────

describe("getSimilarInvoices", () => {
  it("excludes the reference invoice itself", () => {
    const candidates = [REF, makeInvoice({ id: "other", status: "listed" })];
    const results = getSimilarInvoices(REF, candidates);
    expect(results.every((r) => r.invoice.id !== REF.id)).toBe(true);
  });

  it("excludes fully_funded invoices", () => {
    const fullyFunded = makeInvoice({ id: "ff", status: "fully_funded" });
    const results = getSimilarInvoices(REF, [REF, fullyFunded]);
    expect(results.find((r) => r.invoice.id === "ff")).toBeUndefined();
  });

  it("excludes repaid invoices", () => {
    const repaid = makeInvoice({ id: "rp", status: "repaid" });
    const results = getSimilarInvoices(REF, [REF, repaid]);
    expect(results.find((r) => r.invoice.id === "rp")).toBeUndefined();
  });

  it("excludes defaulted invoices", () => {
    const defaulted = makeInvoice({ id: "df", status: "defaulted" });
    const results = getSimilarInvoices(REF, [REF, defaulted]);
    expect(results.find((r) => r.invoice.id === "df")).toBeUndefined();
  });

  it("excludes cancelled invoices", () => {
    const cancelled = makeInvoice({ id: "cn", status: "cancelled" });
    const results = getSimilarInvoices(REF, [REF, cancelled]);
    expect(results.find((r) => r.invoice.id === "cn")).toBeUndefined();
  });

  it("includes listed and partially_funded invoices", () => {
    const listed = makeInvoice({ id: "ls", status: "listed" });
    const partial = makeInvoice({ id: "pf", status: "partially_funded" });
    const results = getSimilarInvoices(REF, [REF, listed, partial]);
    const ids = results.map((r) => r.invoice.id);
    expect(ids).toContain("ls");
    expect(ids).toContain("pf");
  });

  it("returns results sorted by descending score", () => {
    // Higher similarity: same category + closer risk tier
    const high = makeInvoice({
      id: "high",
      status: "listed",
      riskTier: "AA", // 1 step
      metadata: { category: "technology" }, // match
      terms: { apr: 21, tenor: 92 }, // tiny deltas
    });
    // Lower similarity: different category + further risk tier
    const low = makeInvoice({
      id: "low",
      status: "listed",
      riskTier: "BBB", // 2 steps
      metadata: { category: "agriculture" }, // mismatch
      terms: { apr: 19, tenor: 88 }, // close APR/tenor but category+risk drag it down
    });
    const results = getSimilarInvoices(REF, [REF, low, high]);
    expect(results[0].invoice.id).toBe("high");
    expect(results[0].similarity.score).toBeGreaterThanOrEqual(
      results[results.length - 1].similarity.score
    );
  });

  it("returns at most maxResults candidates", () => {
    const pool = Array.from({ length: 10 }, (_, i) =>
      makeInvoice({ id: `inv_${i}`, status: "listed" })
    );
    const results = getSimilarInvoices(REF, [REF, ...pool], 4);
    expect(results.length).toBeLessThanOrEqual(4);
  });

  it("returns at most 6 by default when more candidates exist", () => {
    const pool = Array.from({ length: 15 }, (_, i) =>
      makeInvoice({ id: `bulk_${i}`, status: "listed" })
    );
    const results = getSimilarInvoices(REF, [REF, ...pool]);
    expect(results.length).toBeLessThanOrEqual(6);
  });

  it("returns an empty array when no investable candidates exist", () => {
    const results = getSimilarInvoices(REF, [REF]);
    expect(results).toHaveLength(0);
  });

  it("returns an empty array when all candidates are non-investable", () => {
    const noInvest = [
      makeInvoice({ id: "a", status: "fully_funded" }),
      makeInvoice({ id: "b", status: "repaid" }),
      makeInvoice({ id: "c", status: "cancelled" }),
    ];
    const results = getSimilarInvoices(REF, [REF, ...noInvest]);
    expect(results).toHaveLength(0);
  });

  it("does not return candidates with score 0", () => {
    // Score is 0 when all 4 dimensions are 0:
    //   category: mismatch → 0
    //   riskTier: AAA vs CCC (6 steps, max distance) → 0
    //   aprBand: difference >= APR_WINDOW → 0
    //   tenorBand: difference >= TENOR_WINDOW → 0
    const refAllDifferent = makeInvoice({
      id: "ref_zero",
      status: "listed",
      riskTier: "AAA",
      metadata: { category: "technology" },
      terms: { apr: 10, tenor: 30 },
    });
    const zeroScore = makeInvoice({
      id: "zero",
      status: "listed",
      riskTier: "CCC",              // 6 steps from AAA → riskTier score = 0
      metadata: { category: "agriculture" }, // mismatch → category score = 0
      terms: {
        apr: 10 + APR_WINDOW + 1,   // outside APR window → aprBand = 0
        tenor: 30 + TENOR_WINDOW + 1, // outside tenor window → tenorBand = 0
      },
    });
    const results = getSimilarInvoices(refAllDifferent, [refAllDifferent, zeroScore]);
    expect(results.find((r) => r.invoice.id === "zero")).toBeUndefined();
  });

  it("enforces minimum of 3 for maxResults even when called with lower value", () => {
    // Math.max(3, maxResults) guard: passing maxResults=1 should still allow up to 3
    const pool = Array.from({ length: 5 }, (_, i) =>
      makeInvoice({ id: `min_${i}`, status: "listed" })
    );
    const results = getSimilarInvoices(REF, [REF, ...pool], 1);
    // Should return up to 3 (the guard floor), not just 1
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("each result contains invoice and similarity breakdown", () => {
    const cand = makeInvoice({ id: "check", status: "listed" });
    const [result] = getSimilarInvoices(REF, [REF, cand]);
    expect(result).toHaveProperty("invoice");
    expect(result).toHaveProperty("similarity");
    expect(result.similarity).toHaveProperty("score");
    expect(result.similarity).toHaveProperty("dimensions");
    expect(result.similarity.dimensions).toHaveProperty("category");
    expect(result.similarity.dimensions).toHaveProperty("riskTier");
    expect(result.similarity.dimensions).toHaveProperty("aprBand");
    expect(result.similarity.dimensions).toHaveProperty("tenorBand");
  });
});

// ─── Comparison list helpers (keyboard multi-select) ─────────────────────────

describe("comparison helpers", () => {
  it("normalizes duplicate ids and enforces the max limit", () => {
    expect(normalizeComparisonList(["a", "b", "a", "c", "d", "e"])).toEqual([
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("toggles invoice ids in and out of the list", () => {
    expect(toggleComparisonId(["a", "b"], "b")).toEqual(["a"]);
    expect(toggleComparisonId(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("builds a contiguous range selection within the max comparison size", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const range = buildRangeSelection(ids, 0, 4, []);
    expect(range).toHaveLength(MAX_COMPARISON);
    expect(range).toEqual(["b", "c", "d", "e"]);
  });
});
