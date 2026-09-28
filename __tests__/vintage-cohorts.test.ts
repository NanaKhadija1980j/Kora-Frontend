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

  it("returns an empty array for an empty position list", () => {
    expect(buildVintageCohorts([])).toEqual([]);
  });

  it("labels every emitted row with its readable month", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000),
      pos("2026-03-01T00:00:00Z", 1000),
    ]);

    // The gap month is still labelled — a chart axis needs a tick for it.
    expect(cohorts.map((c) => c.label)).toEqual(["Jan 2026", "Feb 2026", "Mar 2026"]);
  });

  it("treats a non-finite invested amount as zero rather than NaN", () => {
    const cohorts = buildVintageCohorts([
      { fundedAt: "2026-01-01T00:00:00Z", investedAmount: Number.NaN, status: "active" },
      { fundedAt: "2026-01-02T00:00:00Z", investedAmount: 1000, status: "active" },
    ]);

    expect(cohorts[0].totalInvested).toBe(1000);
    expect(Number.isFinite(cohorts[0].totalInvested)).toBe(true);
  });

  it("skips a position whose funding date is an empty string", () => {
    const cohorts = buildVintageCohorts([
      { fundedAt: "", investedAmount: 5000, status: "active" },
      pos("2026-01-01T00:00:00Z", 1000),
    ]);

    expect(cohorts).toHaveLength(1);
    expect(cohorts[0].totalInvested).toBe(1000);
  });

  it("keeps defaulted counting on an empty gap row at zero", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000, { status: "defaulted" }),
      pos("2026-03-01T00:00:00Z", 1000),
    ]);

    const gap = cohorts[1];
    expect(gap.month).toBe("2026-02");
    expect(gap.isEmpty).toBe(true);
    expect(gap.defaultedCount).toBe(0);
    expect(gap.defaultRate).toBe(0);
    expect(gap.totalInvested).toBe(0);
    expect(gap.weightedApr).toBeNull();
  });

  it("counts charged_off and default as defaulted proxies", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000, { status: "charged_off" }),
      pos("2026-01-02T00:00:00Z", 1000, { status: "default" }),
      pos("2026-01-03T00:00:00Z", 1000, { status: "active" }),
    ]);

    expect(cohorts[0].defaultedCount).toBe(2);
    expect(cohorts[0].defaultRate).toBeCloseTo(66.67, 2);
  });

  it("does not count a missing status as defaulted", () => {
    const cohorts = buildVintageCohorts([
      { fundedAt: "2026-01-01T00:00:00Z", investedAmount: 1000, status: null },
      { fundedAt: "2026-01-02T00:00:00Z", investedAmount: 1000 },
    ]);

    expect(cohorts[0].defaultedCount).toBe(0);
  });
});

describe("weighted APR", () => {
  it("returns the position APR verbatim when a cohort has a single carrying position", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 5000, { apr: 7.5 }),
    ]);

    expect(cohorts[0].weightedApr).toBe(7.5);
  });

  it("excludes positions with no APR from the weighting entirely", () => {
    // A missing APR must not be treated as 0% and drag the average down.
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 99_000, { apr: 8 }),
      pos("2026-01-02T00:00:00Z", 90_000, { apr: null }),
    ]);

    expect(cohorts[0].weightedApr).toBe(8);
    // The APR-less position still counts toward exposure.
    expect(cohorts[0].totalInvested).toBe(189_000);
    expect(cohorts[0].positionCount).toBe(2);
  });

  it("excludes a zero-amount position because it cannot carry weight", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000, { apr: 6 }),
      pos("2026-01-02T00:00:00Z", 0, { apr: 99 }),
    ]);

    expect(cohorts[0].weightedApr).toBe(6);
  });

  it("excludes a non-finite APR from the weighting", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000, { apr: Number.NaN }),
    ]);

    expect(cohorts[0].weightedApr).toBeNull();
  });

  it("keeps a zero APR as a real value rather than treating it as absent", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000, { apr: 0 }),
    ]);

    expect(cohorts[0].weightedApr).toBe(0);
  });

  it("weights across three positions in the same cohort", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000, { apr: 10 }),
      pos("2026-01-02T00:00:00Z", 2000, { apr: 12 }),
      pos("2026-01-03T00:00:00Z", 1000, { apr: 14 }),
    ]);

    // (10*1000 + 12*2000 + 14*1000) / 4000
    expect(cohorts[0].weightedApr).toBe(12);
  });

  it("does not let one cohort's APR leak into another", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000, { apr: 5 }),
      pos("2026-02-01T00:00:00Z", 1000, { apr: 15 }),
    ]);

    expect(cohorts[0].weightedApr).toBe(5);
    expect(cohorts[1].weightedApr).toBe(15);
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

  it("falls back to investedAt when fundedAt is null", () => {
    const cohorts = buildVintageCohorts([
      {
        investedAmount: 1000,
        fundedAt: null,
        investedAt: "2026-02-10T00:00:00Z",
        status: "active",
      },
    ]);
    expect(cohorts).toHaveLength(1);
    expect(cohorts[0].month).toBe("2026-02");
  });

  it("groups a mixed fundedAt/investedAt book into the same month", () => {
    // Real data carries both spellings across different sources, so the two
    // cohorts have to merge rather than split on the field name alone.
    const cohorts = buildVintageCohorts([
      { investedAmount: 1000, fundedAt: "2026-01-10T00:00:00Z", status: "active" },
      { investedAmount: 2000, investedAt: "2026-01-20T00:00:00Z", status: "active" },
    ]);

    expect(cohorts).toHaveLength(1);
    expect(cohorts[0].positionCount).toBe(2);
    expect(cohorts[0].totalInvested).toBe(3000);
  });

  it("excludes a position carrying neither date field", () => {
    const cohorts = buildVintageCohorts([
      { investedAmount: 1000, status: "active" },
      pos("2026-01-01T00:00:00Z", 500),
    ]);

    expect(cohorts).toHaveLength(1);
    expect(cohorts[0].totalInvested).toBe(500);
  });

  it("excludes a position whose investedAt is an unparseable date", () => {
    const cohorts = buildVintageCohorts([
      { investedAmount: 5000, investedAt: "whenever", status: "active" },
      pos("2026-01-01T00:00:00Z", 1000),
    ]);

    expect(cohorts).toHaveLength(1);
    expect(cohorts[0].totalInvested).toBe(1000);
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

  it("rounds a fractional weighted APR to two decimals for CSV", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 99_000, { apr: 8 }),
      pos("2026-01-02T00:00:00Z", 1_000, { apr: 20 }),
    ]);

    expect(cohortsToExportRows(cohorts)[0].weightedApr).toBe("8.12");
  });

  it("emits one export row per cohort, gap months included", () => {
    const cohorts = buildVintageCohorts([
      pos("2026-01-01T00:00:00Z", 1000),
      pos("2026-03-01T00:00:00Z", 1000),
    ]);

    const rows = cohortsToExportRows(cohorts);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.vintageLabel)).toEqual([
      "Jan 2026",
      "Feb 2026",
      "Mar 2026",
    ]);
    expect(rows[1]).toMatchObject({
      positionCount: 0,
      totalInvested: 0,
      weightedApr: "",
      defaultedCount: 0,
      defaultRatePercent: "0.00",
    });
  });

  it("exports an empty list when there are no cohorts", () => {
    expect(cohortsToExportRows([])).toEqual([]);
  });
});
