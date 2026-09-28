/**
 * Portfolio concentration risk alerts (issue #604).
 *
 * `portfolioAllocation` already computes how a portfolio splits across risk
 * tiers, jurisdictions and debtors. What it does not do is tell the investor
 * when a split has become dangerous — the allocation chart shows a 70% slice
 * exactly as calmly as it shows a 7% one.
 *
 * This evaluates a portfolio against configured thresholds and returns the
 * breaches. It is deliberately pure: no toasts, no store access, no clock
 * beyond what the caller passes in, so the thresholds can be tested exactly.
 */

export type ConcentrationDimension = "debtor" | "jurisdiction" | "riskTier";

export interface ConcentrationThresholds {
  /** Percent of portfolio value above which a single debtor is flagged. */
  debtor: number;
  /** Percent above which a single jurisdiction is flagged. */
  jurisdiction: number;
  /** Percent above which a single risk tier is flagged. */
  riskTier: number;
}

/**
 * Defaults chosen to be actionable rather than merely conservative: a single
 * debtor at 25% of a private-credit book is a genuine single-name risk, while
 * jurisdiction and tier concentration are common and only interesting higher up.
 */
export const DEFAULT_CONCENTRATION_THRESHOLDS: ConcentrationThresholds = {
  debtor: 25,
  jurisdiction: 40,
  riskTier: 50,
};

export interface ConcentrationPosition {
  investedAmount: number;
  invoice?: {
    riskTier?: string;
    metadata?: {
      jurisdiction?: string;
      debtorName?: string;
    };
  } | null;
}

export interface ConcentrationAlert {
  dimension: ConcentrationDimension;
  /** The concentrated value, e.g. "Acme Corp" or "US". */
  name: string;
  /** Share of portfolio value, as a percentage. */
  percent: number;
  /** Threshold that was exceeded. */
  threshold: number;
  /** Currency value concentrated in this bucket. */
  value: number;
  /** Stable identity for dismissal/snooze, independent of the percentage. */
  key: string;
  severity: "warning" | "critical";
}

/** A breach at or beyond 1.5x its threshold is treated as critical. */
const CRITICAL_MULTIPLIER = 1.5;

const UNKNOWN = "Unknown";

function bucketOf(
  position: ConcentrationPosition,
  dimension: ConcentrationDimension
): string {
  const invoice = position.invoice;
  if (!invoice) return UNKNOWN;
  if (dimension === "riskTier") return invoice.riskTier || UNKNOWN;
  if (dimension === "jurisdiction") return invoice.metadata?.jurisdiction || UNKNOWN;
  return invoice.metadata?.debtorName || UNKNOWN;
}

/** Stable alert identity: dimension + bucket, never the percentage. */
export function concentrationKey(
  dimension: ConcentrationDimension,
  name: string
): string {
  return `${dimension}:${name}`;
}

/**
 * Evaluate a portfolio and return every threshold breach, worst first.
 *
 * Positions with no positive invested amount are ignored: they contribute
 * nothing to concentration and would only distort the denominator.
 */
export function evaluateConcentration(
  positions: ConcentrationPosition[],
  thresholds: ConcentrationThresholds = DEFAULT_CONCENTRATION_THRESHOLDS
): ConcentrationAlert[] {
  const funded = positions.filter(
    (p) => Number.isFinite(p.investedAmount) && p.investedAmount > 0
  );

  const total = funded.reduce((sum, p) => sum + p.investedAmount, 0);
  if (total <= 0) return [];

  const dimensions: ConcentrationDimension[] = [
    "debtor",
    "jurisdiction",
    "riskTier",
  ];

  const alerts: ConcentrationAlert[] = [];

  for (const dimension of dimensions) {
    const threshold = thresholds[dimension];
    // A non-positive threshold disables the dimension rather than flagging
    // everything, which is the intuitive reading of "0 = off".
    if (!Number.isFinite(threshold) || threshold <= 0) continue;

    const totals = new Map<string, number>();
    for (const position of funded) {
      const bucket = bucketOf(position, dimension);
      totals.set(bucket, (totals.get(bucket) ?? 0) + position.investedAmount);
    }

    for (const [name, value] of totals) {
      const percent = (value / total) * 100;
      if (percent <= threshold) continue;

      alerts.push({
        dimension,
        name,
        percent,
        threshold,
        value,
        key: concentrationKey(dimension, name),
        severity:
          percent >= threshold * CRITICAL_MULTIPLIER ? "critical" : "warning",
      });
    }
  }

  return alerts.sort((a, b) => b.percent - a.percent);
}

export interface SnoozeEntry {
  key: string;
  /** Epoch ms after which the alert becomes visible again. */
  until: number;
}

/**
 * Drop alerts the investor has dismissed or snoozed.
 *
 * Snoozes are compared against a caller-supplied `now` so the filter stays
 * pure and the expiry boundary is testable.
 */
export function filterActiveAlerts(
  alerts: ConcentrationAlert[],
  dismissedKeys: string[],
  snoozes: SnoozeEntry[],
  now: number = Date.now()
): ConcentrationAlert[] {
  const dismissed = new Set(dismissedKeys);
  const snoozedUntil = new Map(snoozes.map((s) => [s.key, s.until]));

  return alerts.filter((alert) => {
    if (dismissed.has(alert.key)) return false;
    const until = snoozedUntil.get(alert.key);
    return until === undefined || now >= until;
  });
}

/** Common snooze durations offered in the UI. */
export const SNOOZE_DURATIONS_MS = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
} as const;
