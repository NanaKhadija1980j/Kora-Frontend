/**
 * Vintage cohort analytics (issue #605).
 *
 * Private-credit books are read by *vintage*: positions funded in the same
 * month share an underwriting environment, so comparing March's yield to
 * September's is how you see whether underwriting is drifting. The analytics
 * page already had date filters but no way to group by funding month.
 *
 * Pure module: dates in, cohort rows out. No charts, no store, no clock unless
 * the caller supplies one.
 */

export interface CohortPosition {
  investedAmount: number;
  /**
   * ISO timestamp of when the position was funded.
   *
   * The issue specifies `fundedAt`, but `InvestorPosition` in `types/invoice.ts`
   * calls the same instant `investedAt`. Both are accepted so the module works
   * against the real data without renaming a shared type, and `fundedAt` wins
   * if a caller supplies both.
   */
  fundedAt?: string | null;
  /** Alias for `fundedAt`, matching `InvestorPosition`. */
  investedAt?: string | null;
  /** Annualised percentage rate, if known. */
  apr?: number | null;
  /** Terminal state, used to derive the default proxy. */
  status?: string | null;
}

export interface CohortRow {
  /** Sortable cohort id, `YYYY-MM`. */
  month: string;
  /** Display label, e.g. "Mar 2026". */
  label: string;
  positionCount: number;
  totalInvested: number;
  /** Invested-amount-weighted APR; null when no position carries an APR. */
  weightedApr: number | null;
  /** Positions in a defaulted state. */
  defaultedCount: number;
  /** defaultedCount / positionCount, as a percentage. */
  defaultRate: number;
  /** True when the month falls inside the range but has no positions. */
  isEmpty: boolean;
}

/** Statuses treated as a default proxy. */
const DEFAULTED_STATUSES = new Set(["defaulted", "default", "written_off", "charged_off"]);

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Bucket key for a funding date, in UTC.
 *
 * UTC deliberately: bucketing in local time would move a position between
 * cohorts depending on the viewer's timezone, so two people could read the same
 * portfolio differently.
 */
export function vintageMonthKey(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const month = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  return `${d.getUTCFullYear()}-${month}`;
}

/** "2026-03" -> "Mar 2026". */
export function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const index = Number.parseInt(m, 10) - 1;
  if (!year || Number.isNaN(index) || index < 0 || index > 11) return month;
  return `${MONTH_LABELS[index]} ${year}`;
}

/** Every month from `first` to `last` inclusive, so gaps stay visible. */
export function monthRange(first: string, last: string): string[] {
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  if (!fy || !fm || !ly || !lm) return [];

  const months: string[] = [];
  let year = fy;
  let month = fm;
  // Guard against a reversed range producing an unbounded loop.
  while (year < ly || (year === ly && month <= lm)) {
    months.push(`${year}-${`${month}`.padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export interface CohortOptions {
  /**
   * Emit months with no positions between the first and last cohort.
   *
   * On by default: a gap month is information — it usually means origination
   * stopped — and hiding it makes a sparse book look continuous.
   */
  includeEmptyMonths?: boolean;
}

/**
 * Group positions into vintage cohorts, oldest first.
 *
 * Positions with a missing or unparseable `fundedAt` are excluded rather than
 * bucketed into a placeholder cohort, which would silently distort every
 * comparison.
 */
export function buildVintageCohorts(
  positions: CohortPosition[],
  options: CohortOptions = {}
): CohortRow[] {
  const { includeEmptyMonths = true } = options;

  const buckets = new Map<string, CohortPosition[]>();

  for (const position of positions) {
    const fundedAt = position.fundedAt ?? position.investedAt;
    if (!fundedAt) continue;
    const key = vintageMonthKey(fundedAt);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(position);
    else buckets.set(key, [position]);
  }

  if (buckets.size === 0) return [];

  const present = Array.from(buckets.keys()).sort();
  const months = includeEmptyMonths
    ? monthRange(present[0], present[present.length - 1])
    : present;

  return months.map((month) => {
    const bucket = buckets.get(month) ?? [];

    const totalInvested = bucket.reduce(
      (sum, p) => sum + (Number.isFinite(p.investedAmount) ? p.investedAmount : 0),
      0
    );

    // Weight APR by invested amount: a $1m position at 8% should not be
    // averaged against a $1k position at 20% as though they were equals.
    let weightedApr: number | null = null;
    const withApr = bucket.filter(
      (p) => typeof p.apr === "number" && Number.isFinite(p.apr) && p.investedAmount > 0
    );
    if (withApr.length > 0) {
      const weightTotal = withApr.reduce((sum, p) => sum + p.investedAmount, 0);
      if (weightTotal > 0) {
        weightedApr =
          withApr.reduce((sum, p) => sum + (p.apr as number) * p.investedAmount, 0) /
          weightTotal;
      }
    }

    const defaultedCount = bucket.filter((p) =>
      DEFAULTED_STATUSES.has((p.status ?? "").toLowerCase())
    ).length;

    return {
      month,
      label: formatMonthLabel(month),
      positionCount: bucket.length,
      totalInvested,
      weightedApr,
      defaultedCount,
      defaultRate: bucket.length > 0 ? (defaultedCount / bucket.length) * 100 : 0,
      isEmpty: bucket.length === 0,
    };
  });
}

/** Flatten cohorts into CSV rows for portfolio export. */
export function cohortsToExportRows(
  cohorts: CohortRow[]
): Array<Record<string, string | number>> {
  return cohorts.map((c) => ({
    vintageMonth: c.month,
    vintageLabel: c.label,
    positionCount: c.positionCount,
    totalInvested: c.totalInvested,
    weightedApr: c.weightedApr === null ? "" : c.weightedApr.toFixed(2),
    defaultedCount: c.defaultedCount,
    defaultRatePercent: c.defaultRate.toFixed(2),
  }));
}
