/**
 * Secondary market fee schedule (issue #597).
 *
 * Fees are disclosed before a trade is confirmed, so the numbers on screen and
 * the numbers charged must come from one place. This module is that place: it
 * owns the arithmetic, and the UI only formats what it returns.
 *
 * ## Why basis points, and why integers
 *
 * Rates are configured in basis points (100 bps = 1%) rather than as decimal
 * percentages, because `0.5%` in a float config is a rounding argument waiting
 * to happen. All rounding is deliberate and happens once, at the end.
 *
 * Money is rounded to cents with `Math.round`, and the **total is derived by
 * addition of the rounded parts**, never rounded separately. If the parts were
 * rounded independently of the total, a disclosed breakdown could fail to add
 * up to the disclosed total by a cent — which is exactly the kind of detail
 * that destroys trust in a fee disclosure.
 */

export interface FeeSchedule {
  /** Protocol fee, basis points. */
  protocolBps: number;
  /** Marketplace/venue fee, basis points. */
  marketBps: number;
}

export interface FeeBreakdown {
  /** Price of the position itself, before fees. */
  subtotal: number;
  /** Protocol fee in currency units. */
  protocolFee: number;
  /** Marketplace fee in currency units. */
  marketFee: number;
  /** protocolFee + marketFee. */
  totalFees: number;
  /** subtotal + totalFees — what the buyer actually pays. */
  total: number;
  /** Combined rate in basis points, for display. */
  totalBps: number;
  /** The schedule these figures were computed from. */
  schedule: FeeSchedule;
}

const BPS_DIVISOR = 10_000;

/** Round to cents. Kept in one place so every figure rounds identically. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Apply a basis-point rate to an amount.
 *
 * Exported for testing: the bps→currency step is where a fee disclosure most
 * plausibly goes wrong, so it is worth pinning on its own.
 */
export function applyBps(amount: number, bps: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(bps)) return 0;
  if (amount <= 0 || bps <= 0) return 0;
  return toCents((amount * bps) / BPS_DIVISOR);
}

/**
 * Compute the full fee breakdown for an acquisition.
 *
 * A non-finite or negative price yields an all-zero breakdown rather than
 * `NaN`, so a malformed listing cannot render "$NaN" into a disclosure.
 */
export function computeAcquisitionFees(
  askPrice: number,
  schedule: FeeSchedule
): FeeBreakdown {
  const safePrice =
    Number.isFinite(askPrice) && askPrice > 0 ? toCents(askPrice) : 0;

  const protocolBps = normaliseBps(schedule.protocolBps);
  const marketBps = normaliseBps(schedule.marketBps);

  const protocolFee = applyBps(safePrice, protocolBps);
  const marketFee = applyBps(safePrice, marketBps);

  // Sum the rounded parts so the breakdown always reconciles with the total.
  const totalFees = toCents(protocolFee + marketFee);

  return {
    subtotal: safePrice,
    protocolFee,
    marketFee,
    totalFees,
    total: toCents(safePrice + totalFees),
    totalBps: protocolBps + marketBps,
    schedule: { protocolBps, marketBps },
  };
}

/** Clamp a configured rate into [0, 10000] bps. */
function normaliseBps(bps: number): number {
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.min(Math.round(bps), BPS_DIVISOR);
}

/**
 * Render a basis-point rate as a percentage string.
 *
 * Trailing zeros are trimmed so 50 bps reads "0.5%", not "0.50%", while 25 bps
 * still reads "0.25%".
 */
export function formatBps(bps: number): string {
  const safe = normaliseBps(bps);
  const percent = safe / 100;
  const fixed = percent.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${fixed === "" ? "0" : fixed}%`;
}

/** Read the configured schedule from validated env. */
export function getFeeSchedule(source: {
  NEXT_PUBLIC_SECONDARY_PROTOCOL_FEE_BPS: number;
  NEXT_PUBLIC_SECONDARY_MARKET_FEE_BPS: number;
}): FeeSchedule {
  return {
    protocolBps: normaliseBps(source.NEXT_PUBLIC_SECONDARY_PROTOCOL_FEE_BPS),
    marketBps: normaliseBps(source.NEXT_PUBLIC_SECONDARY_MARKET_FEE_BPS),
  };
}
