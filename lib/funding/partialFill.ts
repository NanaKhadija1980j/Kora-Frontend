/**
 * Partial-fill funding math and validation.
 *
 * Pure helpers shared by the marketplace funding panel so that remaining
 * capacity, min/max ticket clamps and balance checks are computed in one
 * place instead of being re-derived inline in the UI.
 *
 * Validation returns i18n message keys (plus interpolation values) rather
 * than formatted strings — formatting stays the caller's job.
 */

/** Tolerance for float comparisons on 2-decimal money amounts. */
const EPSILON = 1e-9;

export type FundingRejectionReason =
  | "invalid"
  | "notPositive"
  | "belowMinTicket"
  | "aboveMaxTicket"
  | "exceedsCapacity"
  | "insufficientBalance"
  | "dustRemainder";

export interface FundingLimits {
  /** Capacity still open on the invoice, in the invoice currency. */
  remainingCapacity: number;
  /** Smallest ticket an investor may take. */
  minTicket: number;
  /** Largest single ticket, when the listing caps it. */
  maxTicket?: number | null;
  /** Investor's spendable USDC balance; `null`/`undefined` when unknown. */
  availableBalance?: number | null;
}

export interface FundingEvaluation {
  ok: boolean;
  reason?: FundingRejectionReason;
  /** Key under the `invoiceDetail.errors` namespace. */
  messageKey?: string;
  /** Interpolation values for `messageKey`. */
  values?: Record<string, number>;
  /** Parsed amount when the input was numeric. */
  amount?: number;
}

/** Remaining capacity of a listing, never negative. */
export function computeRemainingCapacity(financingAmount: number, totalRaised: number): number {
  if (!Number.isFinite(financingAmount) || !Number.isFinite(totalRaised)) return 0;
  return Math.max(0, financingAmount - totalRaised);
}

/**
 * Largest amount an investor can currently fund: the remaining capacity,
 * bounded by the max ticket and their balance.
 */
export function maxFundableAmount(limits: FundingLimits): number {
  const caps = [limits.remainingCapacity];
  if (typeof limits.maxTicket === "number" && limits.maxTicket > 0) {
    caps.push(limits.maxTicket);
  }
  if (typeof limits.availableBalance === "number") {
    caps.push(limits.availableBalance);
  }
  return Math.max(0, Math.min(...caps));
}

/** Clamp a requested amount into the fundable band. */
export function clampFundingAmount(amount: number, limits: FundingLimits): number {
  if (!Number.isFinite(amount)) return 0;
  const ceiling = maxFundableAmount(limits);
  if (ceiling <= 0) return 0;
  return Math.min(Math.max(amount, Math.min(limits.minTicket, ceiling)), ceiling);
}

/**
 * True when funding `amount` would leave a remainder too small for anyone
 * else to take (dust). Such a fill has to be an all-or-nothing full fill.
 */
export function leavesDustRemainder(amount: number, limits: FundingLimits): boolean {
  const remainder = limits.remainingCapacity - amount;
  return remainder > EPSILON && remainder < limits.minTicket - EPSILON;
}

/**
 * Validate a funding amount against capacity, ticket size and balance.
 * Checks run cheapest-and-most-specific first so the investor sees the one
 * reason that actually blocks them.
 */
export function evaluateFundingAmount(
  raw: string | number,
  limits: FundingLimits
): FundingEvaluation {
  const amount = typeof raw === "number" ? raw : Number.parseFloat(String(raw).trim());

  if (!Number.isFinite(amount)) {
    return { ok: false, reason: "invalid", messageKey: "invalidAmount" };
  }
  if (amount <= 0) {
    return { ok: false, reason: "notPositive", messageKey: "invalidAmount", amount };
  }
  if (amount < limits.minTicket - EPSILON) {
    return {
      ok: false,
      reason: "belowMinTicket",
      messageKey: "minInvestment",
      values: { amount: limits.minTicket },
      amount,
    };
  }
  if (amount > limits.remainingCapacity + EPSILON) {
    return {
      ok: false,
      reason: "exceedsCapacity",
      messageKey: "exceedsCapacity",
      values: { amount: limits.remainingCapacity },
      amount,
    };
  }
  if (
    typeof limits.maxTicket === "number" &&
    limits.maxTicket > 0 &&
    amount > limits.maxTicket + EPSILON
  ) {
    return {
      ok: false,
      reason: "aboveMaxTicket",
      messageKey: "maxInvestment",
      values: { amount: limits.maxTicket },
      amount,
    };
  }
  if (leavesDustRemainder(amount, limits)) {
    return {
      ok: false,
      reason: "dustRemainder",
      messageKey: "dustRemainder",
      values: { amount: limits.remainingCapacity, min: limits.minTicket },
      amount,
    };
  }
  if (typeof limits.availableBalance === "number" && amount > limits.availableBalance + EPSILON) {
    return {
      ok: false,
      reason: "insufficientBalance",
      messageKey: "insufficientBalance",
      values: { amount: limits.availableBalance },
      amount,
    };
  }

  return { ok: true, amount };
}
