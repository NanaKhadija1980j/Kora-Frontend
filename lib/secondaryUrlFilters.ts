/**
 * Secondary market URL filter helpers (#643).
 *
 * Reads/writes shareable query params (q, tenor, yield, seller, highlight)
 * with the same sanitization rules as sanitizeQueryParam + whitelist fallbacks.
 */

/** Mirrors lib/security.sanitizeQueryParam without importing env-bound modules. */
function sanitizeQueryParam(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/[^\x20-\x7E]/g, "").slice(0, 256);
}

export const SECONDARY_PARAM = {
  SEARCH: "q",
  TENOR: "tenor",
  YIELD: "yield",
  SELLER: "seller",
  HIGHLIGHT: "highlight",
} as const;

export interface SecondaryUrlFilters {
  q: string;
  tenor: string;
  yield: string;
  seller: string;
  highlight: string;
}

export const DEFAULT_SECONDARY_FILTERS: SecondaryUrlFilters = {
  q: "",
  tenor: "all",
  yield: "0",
  seller: "",
  highlight: "",
};

/** Keep in sync with TENOR_OPTIONS / YIELD_OPTIONS in marketplace/filters. */
const TENOR_VALUES = new Set(["all", "0-30", "31-60", "61-90", "90+"]);
const YIELD_VALUES = new Set(["0", "5", "10", "15"]);

/** Whitelist tenor query value; invalid → "all". */
export function parseTenorParam(raw: string | null | undefined): string {
  const value = sanitizeQueryParam(raw);
  return TENOR_VALUES.has(value) ? value : DEFAULT_SECONDARY_FILTERS.tenor;
}

/** Whitelist yield query value; invalid → "0". */
export function parseYieldParam(raw: string | null | undefined): string {
  const value = sanitizeQueryParam(raw);
  return YIELD_VALUES.has(value) ? value : DEFAULT_SECONDARY_FILTERS.yield;
}

/** Sanitize free-text search / seller / highlight params. */
export function parseTextParam(raw: string | null | undefined): string {
  return sanitizeQueryParam(raw);
}

/** Hydrate filter state from a URLSearchParams (or ReadonlyURLSearchParams). */
export function parseSecondaryFiltersFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">
): SecondaryUrlFilters {
  return {
    q: parseTextParam(searchParams.get(SECONDARY_PARAM.SEARCH)),
    tenor: parseTenorParam(searchParams.get(SECONDARY_PARAM.TENOR)),
    yield: parseYieldParam(searchParams.get(SECONDARY_PARAM.YIELD)),
    seller: parseTextParam(searchParams.get(SECONDARY_PARAM.SELLER)),
    highlight: parseTextParam(searchParams.get(SECONDARY_PARAM.HIGHLIGHT)),
  };
}

/**
 * Build query string for secondary filters, omitting defaults so reset clears the URL.
 */
export function secondaryFiltersToQueryString(filters: SecondaryUrlFilters): string {
  const params = new URLSearchParams();
  const q = sanitizeQueryParam(filters.q);
  const seller = sanitizeQueryParam(filters.seller);
  const highlight = sanitizeQueryParam(filters.highlight);
  const tenor = parseTenorParam(filters.tenor);
  const yieldValue = parseYieldParam(filters.yield);

  if (q) params.set(SECONDARY_PARAM.SEARCH, q);
  if (tenor !== DEFAULT_SECONDARY_FILTERS.tenor) params.set(SECONDARY_PARAM.TENOR, tenor);
  if (yieldValue !== DEFAULT_SECONDARY_FILTERS.yield) {
    params.set(SECONDARY_PARAM.YIELD, yieldValue);
  }
  if (seller) params.set(SECONDARY_PARAM.SELLER, seller);
  if (highlight) params.set(SECONDARY_PARAM.HIGHLIGHT, highlight);

  return params.toString();
}
