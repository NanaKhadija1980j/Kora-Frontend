/**
 * lib/comparison.ts
 *
 * Invoice Similarity Scoring
 * ==========================
 * Computes a 0–100 similarity score between a reference invoice and a
 * candidate invoice using a weighted, multi-dimensional feature set.
 *
 * ## Dimensions & Weights
 *
 * | Dimension   | Weight | Detail                                              |
 * |-------------|--------|-----------------------------------------------------|
 * | Category    | 30%    | Exact match on `InvoiceCategory`                    |
 * | Risk Tier   | 25%    | Proximity on ordered tier ladder (AAA→CCC)          |
 * | APR Band    | 25%    | Proximity within a ±5% absolute APR window           |
 * | Tenor Band  | 20%    | Proximity within a ±30-day tenor window              |
 *
 * Each dimension yields a partial score in [0, 1] which is then multiplied
 * by its weight.  The four weighted partials are summed → final score [0, 100].
 *
 * ## Filters applied before scoring
 * - Excludes the reference invoice itself (by `id`).
 * - Excludes invoices with statuses: `fully_funded`, `repaid`, `defaulted`,
 *   `cancelled` (non-investable states).
 *
 * ## Result
 * `getSimilarInvoices` returns up to `maxResults` candidates ranked by
 * descending score.  Candidates with a score of 0 are never returned.
 */

import type { Invoice, RiskTier, InvoiceCategory } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Ordered risk tiers from safest to riskiest. */
const RISK_TIER_ORDER: RiskTier[] = [
  "AAA",
  "AA",
  "A",
  "BBB",
  "BB",
  "B",
  "CCC",
];

/** Statuses considered non-investable — excluded from recommendations. */
const EXCLUDED_STATUSES = new Set<string>([
  "fully_funded",
  "repaid",
  "defaulted",
  "cancelled",
]);

/** Scoring dimension weights — must sum to 1. */
const WEIGHTS = {
  /** Exact category match */
  category: 0.30,
  /** Adjacent-tier proximity on the AAA→CCC ladder */
  riskTier: 0.25,
  /** APR band proximity (±5% window) */
  aprBand: 0.25,
  /** Tenor band proximity (±30 days window) */
  tenorBand: 0.20,
} as const;

/** Half-width of the APR proximity window (absolute %-points). */
const APR_WINDOW = 5;

/** Half-width of the tenor proximity window (days). */
const TENOR_WINDOW = 30;

// ─── Dimension Scorers ────────────────────────────────────────────────────────

/**
 * Category score: 1.0 for an exact match, 0.0 otherwise.
 */
function scoreCategory(ref: InvoiceCategory, candidate: InvoiceCategory): number {
  return ref === candidate ? 1.0 : 0.0;
}

/**
 * Risk tier score: 1.0 for same tier, decaying linearly by number of steps
 * on the 7-point AAA→CCC ladder.
 *
 * Steps apart → score:
 *   0 → 1.0  (same tier)
 *   1 → 0.83
 *   2 → 0.67
 *   3 → 0.50
 *   4 → 0.33
 *   5 → 0.17
 *   6 → 0.0  (opposite ends)
 */
function scoreRiskTier(ref: RiskTier, candidate: RiskTier): number {
  const refIdx = RISK_TIER_ORDER.indexOf(ref);
  const candIdx = RISK_TIER_ORDER.indexOf(candidate);
  if (refIdx === -1 || candIdx === -1) return 0.0;
  const steps = Math.abs(refIdx - candIdx);
  const maxSteps = RISK_TIER_ORDER.length - 1; // 6
  return 1.0 - steps / maxSteps;
}

/**
 * APR band score: 1.0 when the candidate's APR is identical to the reference.
 * Decays linearly to 0.0 at ±APR_WINDOW percentage-points.
 * Returns 0.0 outside the window.
 */
function scoreAprBand(refApr: number, candidateApr: number): number {
  const diff = Math.abs(refApr - candidateApr);
  if (diff >= APR_WINDOW) return 0.0;
  return 1.0 - diff / APR_WINDOW;
}

/**
 * Tenor band score: 1.0 when tenors are identical.
 * Decays linearly to 0.0 at ±TENOR_WINDOW days.
 * Returns 0.0 outside the window.
 */
function scoreTenorBand(refTenor: number, candidateTenor: number): number {
  const diff = Math.abs(refTenor - candidateTenor);
  if (diff >= TENOR_WINDOW) return 0.0;
  return 1.0 - diff / TENOR_WINDOW;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Detailed per-dimension breakdown alongside the composite score. */
export interface SimilarityBreakdown {
  /** Weighted composite similarity in [0, 100] */
  score: number;
  /** Individual dimension contributions (weighted, in [0, 1]) */
  dimensions: {
    category: number;
    riskTier: number;
    aprBand: number;
    tenorBand: number;
  };
}

/**
 * Compute the similarity score between a reference invoice and a single
 * candidate invoice.
 *
 * Returns a `SimilarityBreakdown` with a `score` in [0, 100] and the
 * per-dimension weighted contributions so callers can explain the ranking.
 */
export function computeSimilarityScore(
  reference: Invoice,
  candidate: Invoice
): SimilarityBreakdown {
  const catRaw = scoreCategory(
    reference.metadata.category,
    candidate.metadata.category
  );
  const riskRaw = scoreRiskTier(reference.riskTier, candidate.riskTier);
  const aprRaw = scoreAprBand(reference.terms.apr, candidate.terms.apr);
  const tenorRaw = scoreTenorBand(reference.terms.tenor, candidate.terms.tenor);

  const dimensions = {
    category: catRaw * WEIGHTS.category,
    riskTier: riskRaw * WEIGHTS.riskTier,
    aprBand: aprRaw * WEIGHTS.aprBand,
    tenorBand: tenorRaw * WEIGHTS.tenorBand,
  };

  const score =
    (dimensions.category +
      dimensions.riskTier +
      dimensions.aprBand +
      dimensions.tenorBand) *
    100;

  return { score, dimensions };
}

export interface SimilarInvoice {
  invoice: Invoice;
  similarity: SimilarityBreakdown;
}

/**
 * Find invoices similar to `reference` from `candidates`.
 *
 * @param reference   The invoice currently being viewed.
 * @param candidates  Pool of all known invoices (typically the cached list).
 * @param maxResults  Maximum number of results to return (default 6, min 3).
 * @returns           Up to `maxResults` invoices ranked by descending similarity
 *                    score, with only investable statuses included.
 */
export function getSimilarInvoices(
  reference: Invoice,
  candidates: Invoice[],
  maxResults = 6
): SimilarInvoice[] {
  return candidates
    .filter(
      (c) =>
        // never include the reference invoice itself
        c.id !== reference.id &&
        // only show investable invoices
        !EXCLUDED_STATUSES.has(c.status)
    )
    .map((c) => ({
      invoice: c,
      similarity: computeSimilarityScore(reference, c),
    }))
    .filter((s) => s.similarity.score > 0)
    .sort((a, b) => b.similarity.score - a.similarity.score)
    .slice(0, Math.max(3, maxResults));
}

// ─── Re-exported constants (used in tests / UI) ───────────────────────────────

export { RISK_TIER_ORDER, EXCLUDED_STATUSES, WEIGHTS, APR_WINDOW, TENOR_WINDOW };

// ─── Comparison list helpers (keyboard multi-select / store) ─────────────────

/**
 * Invoice comparison limits shared by store + marketplace UI.
 */
export const MAX_COMPARISON_INVOICES = 4;

/** @deprecated Prefer MAX_COMPARISON_INVOICES — kept for PR keyboard helpers. */
export const MAX_COMPARISON = MAX_COMPARISON_INVOICES;

export function normalizeComparisonList(ids: string[]): string[] {
  const unique = ids.filter((id, index) => id && ids.indexOf(id) === index);
  return unique.slice(-MAX_COMPARISON_INVOICES);
}

export function toggleComparisonId(ids: string[], id: string): string[] {
  if (ids.includes(id)) {
    return ids.filter((entry) => entry !== id);
  }
  return normalizeComparisonList([...ids, id]);
}

export function buildRangeSelection(
  orderedIds: string[],
  anchorIndex: number,
  targetIndex: number,
  existingIds: string[]
): string[] {
  if (orderedIds.length === 0) return [];
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  const range = orderedIds.slice(start, end + 1);
  return normalizeComparisonList([
    ...existingIds.filter((id) => !orderedIds.includes(id)),
    ...range,
  ]);
}
