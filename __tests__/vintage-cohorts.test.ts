/**
 * Vintage cohort analytics (issue #605).
 */

import { describe, it, expect } from "vitest";
import {
  buildVintageCohorts,
  cohortsToExportRows,
  formatMonthLabel,
  monthRange,
  vintageMonthKey,
  type CohortPosition,
} from "@/lib/vintageCohorts";

function pos(
  fundedAt: string | null,
  investedAmount: number,
  extra: { apr?: number | null; status?: string } = {}
): CohortPosition {
  return { fundedAt, investedAmount, apr: extra.apr ?? null, status: extra.status ?? "active" };
}

describe("vintageMonthKey", () => {
  it("buckets by UTC year and month", () => {
    expect(vintageMonthKey("2026-03-15T12:00:00.000Z")).toBe("2026-03");
  });

  it("zero-pads single-digit months so keys sort lexically", () => {
    expect(vintageMonthKey("2026-01-05T00:00:00.000Z")).toBe("2026-01");
  });

  it("buckets in UTC, not local time", () => {
    // Late-UTC on the last day of a month must not slide into the next one
    // depending on where the reader happens to be.
    expect(vintageMonthKey("2026-03-31T23:59:59.000Z")).toBe("2026-03");
    expect(vintageMonthKey("2026-04-01T00:00:00.000Z")).toBe("2026-04");
  });

  it.each([["empty", ""], ["garbage", "not-a-date"]])(
    "returns null for %s input",
    (_l, value) => {
      expect(vintageMonthKey(value)).toBeNull();
    }
  );
});

describe("formatMonthLabel", () => {
  it("renders a readable label", () => {
    expect(formatMonthLabel("2026-03")).toBe("Mar 2026");
    expect(formatMonthLabel("2026-12")).toBe("Dec 2026");
  });

  it("passes malformed input through unchanged", () => {
    expect(formatMonthLabel("nonsense")).toBe("nonsense");
    expect(formatMonthLabel("2026-13")).toBe("2026-13");
  });
});

describe("monthRange", () => {
  it("covers an inclusive span", () => {
    expect(monthRange("2026-01", "2026-04")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
  });

  it("rolls over a year boundary", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("returns a single month when both ends match", () => {
    expect(monthRange("2026-05", "2026-05")).toEqual(["2026-05"]);
  });

  it("returns nothing for a reversed range rather than looping forever", () => {
    expect(monthRange("2026-05", "2026-01")).toEqual([]);
  });
});

describe("buildVintageCohorts", () => {
  it("returns nothing when no position has a funding date", () => {
    expect(buildVintageCohorts([pos(null, 1000)])).toEqual([]);
  });

  it("groups positions by funding month", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-10T00:00:00Z", 1000),
      pos("2026-01-20T00:00:00Z", 2000),
      pos("2026-02-05T00:00:00Z", 500),
    ]);

    expect(cohorts).toHaveLength(2);
    expect(cohorts[0].month).toBe("2026-01");
    expect(cohorts[0].positionCount).toBe(2);
    expect(cohorts[0].totalInvested).toBe(3000);
    expect(cohorts[1].month).toBe("2026-02");
  });

  it("orders cohorts oldest first", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-05-01T00:00:00Z", 100),
      pos("2026-01-01T00:00:00Z", 100),
    ]);
    expect(cohorts[0].month).toBe("2026-01");
    expect(cohorts[cohorts.length - 1].month).toBe("2026-05");
  });

  it("emits empty months between cohorts so gaps stay visible", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000),
      pos("2026-04-01T00:00:00Z", 1000),
    ]);

    expect(cohorts.map((c) => c.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
    expect(cohorts[1].isEmpty).toBe(true);
    expect(cohorts[1].positionCount).toBe(0);
    expect(cohorts[1].defaultRate).toBe(0);
  });

  it("can omit empty months on request", () => {
    const cohorts = buildVintageCohorts(
      [pos("2026-01-01T00:00:00Z", 1000), pos("2026-04-01T00:00:00Z", 1000)],
      { includeEmptyMonths: false }
    );
    expect(cohorts.map((c) => c.month)).toEqual(["2026-01", "2026-04"]);
  });

  it("weights APR by invested amount, not by position count", () => {
    // A large low-yield position must dominate a tiny high-yield one.
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 99_000, { apr: 8 }),
      pos("2026-01-15T00:00:00Z", 1_000, { apr: 20 }),
    ]);

    // Simple mean would be 14; weighted is ~8.12.
    expect(cohorts[0].weightedApr).toBeCloseTo(8.12, 2);
  });

  it("reports a null APR when no position carries one", () => {
    const cohorts = buildVintageCohorts([pos("2026-01-01T00:00:00Z", 1000)]);
    expect(cohorts[0].weightedApr).toBeNull();
  });

  it("computes a default rate from terminal statuses", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000, { status: "defaulted" }),
      pos("2026-01-02T00:00:00Z", 1000, { status: "repaid" }),
      pos("2026-01-03T00:00:00Z", 1000, { status: "active" }),
      pos("2026-01-04T00:00:00Z", 1000, { status: "written_off" }),
    ]);

    expect(cohorts[0].defaultedCount).toBe(2);
    expect(cohorts[0].defaultRate).toBeCloseTo(50, 5);
  });

  it("matches default statuses case-insensitively", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000, { status: "DEFAULTED" }),
    ]);
    expect(cohorts[0].defaultedCount).toBe(1);
  });

  it("excludes positions with an unparseable funding date", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000),
      pos("not-a-date", 5000),
    ]);

    // The bad row must not distort the cohort it would have landed in.
    expect(cohorts).toHaveLength(1);
    expect(cohorts[0].totalInvested).toBe(1000);
  });
});

describe("investedAt alias", () => {
  it("accepts investedAt, the field name InvestorPosition actually uses", () => {
    const cohorts = buildVintageCohorts([
      { investedAmount: 1000, investedAt: "2026-01-10T00:00:00Z", status: "active" },
    ]);
    expect(cohorts).toHaveLength(1);
    expect(cohorts[0].month).toBe("2026-01");
  });

  it("prefers fundedAt when a caller supplies both", () => {
    const cohorts = buildVintageCohorts([
      {
        investedAmount: 1000,
        fundedAt: "2026-05-01T00:00:00Z",
        investedAt: "2026-01-01T00:00:00Z",
        status: "active",
      },
    ]);
    expect(cohorts[0].month).toBe("2026-05");
  });
});

describe("cohortsToExportRows", () => {
  it("flattens cohorts for CSV export", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000, { apr: 10, status: "defaulted" }),
    ]);
    const rows = cohortsToExportRows(cohorts);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      vintageMonth: "2026-01",
      vintageLabel: "Jan 2026",
      positionCount: 1,
      totalInvested: 1000,
      weightedApr: "10.00",
      defaultedCount: 1,
      defaultRatePercent: "100.00",
    });
  });

  it("exports an empty string rather than null for a missing APR", () => {
    const cohorts = buildVintageCohorts([pos("2026-01-01T00:00:00Z", 1000)]);
    expect(cohortsToExportRows(cohorts)[0].weightedApr).toBe("");
  });
});
