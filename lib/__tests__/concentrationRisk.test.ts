/**
 * Unit tests for `lib/concentrationRisk` — Issue #695.
 *
 * Colocated with the module under `lib/__tests__/` per CONTRIBUTING.md. The
 * module is pure by design, so these pin the threshold arithmetic exactly:
 * which bucket each dimension reads, where the warning and critical boundaries
 * sit, and how the degenerate portfolios behave — empty, all-zero, and the
 * single position that is by definition 100% of everything.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONCENTRATION_THRESHOLDS,
  SNOOZE_DURATIONS_MS,
  concentrationKey,
  evaluateConcentration,
  filterActiveAlerts,
  type ConcentrationAlert,
  type ConcentrationDimension,
  type ConcentrationPosition,
} from "@/lib/concentrationRisk";

function position(
  investedAmount: number,
  opts: { debtor?: string; jurisdiction?: string; riskTier?: string } = {}
): ConcentrationPosition {
  return {
    investedAmount,
    invoice: {
      riskTier: opts.riskTier ?? "AAA",
      metadata: {
        jurisdiction: opts.jurisdiction ?? "US",
        debtorName: opts.debtor ?? "Debtor",
      },
    },
  };
}

/**
 * Spread a portfolio across enough distinct buckets that only the dimension
 * under test can breach. Without this every fixture trips the jurisdiction and
 * risk-tier thresholds too, and a "debtor" assertion passes for the wrong reason.
 */
function diversifiedExcept(
  dimension: ConcentrationDimension,
  shares: Array<[string, number]>
): ConcentrationPosition[] {
  const spread = ["US", "EU", "UK", "NG", "KE", "GH", "ZA", "OTHER"];
  const tiers = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CC"];

  return shares.map(([bucket, amount], i) => {
    const base = {
      debtor: `debtor-${i}`,
      jurisdiction: spread[i % spread.length],
      riskTier: tiers[i % tiers.length],
    };
    const override =
      dimension === "debtor"
        ? { debtor: bucket }
        : dimension === "jurisdiction"
          ? { jurisdiction: bucket }
          : { riskTier: bucket };
    return position(amount, { ...base, ...override });
  });
}

function alertFor(
  alerts: ConcentrationAlert[],
  dimension: ConcentrationDimension,
  name: string
): ConcentrationAlert | undefined {
  return alerts.find((a) => a.dimension === dimension && a.name === name);
}

describe("DEFAULT_CONCENTRATION_THRESHOLDS", () => {
  it("pins the shipped defaults", () => {
    // These are user-visible risk policy, not an implementation detail — a
    // silent change to any of them changes when investors get warned.
    expect(DEFAULT_CONCENTRATION_THRESHOLDS).toEqual({
      debtor: 25,
      jurisdiction: 40,
      riskTier: 50,
    });
  });
});

describe("concentrationKey", () => {
  it("namespaces the bucket by dimension", () => {
    expect(concentrationKey("debtor", "Acme")).toBe("debtor:Acme");
    expect(concentrationKey("jurisdiction", "US")).toBe("jurisdiction:US");
    expect(concentrationKey("riskTier", "AAA")).toBe("riskTier:AAA");
  });

  it("does not collide across dimensions that share a bucket name", () => {
    expect(concentrationKey("debtor", "US")).not.toBe(
      concentrationKey("jurisdiction", "US")
    );
  });
});

describe("evaluateConcentration — empty portfolios", () => {
  it("returns no alerts for an empty position list", () => {
    expect(evaluateConcentration([])).toEqual([]);
  });

  it("returns no alerts when every position is zero", () => {
    // Total is zero, so every percentage would be a division by zero.
    expect(
      evaluateConcentration([position(0, { debtor: "A" }), position(0, { debtor: "B" })])
    ).toEqual([]);
  });

  it("returns no alerts when every position is negative", () => {
    expect(evaluateConcentration([position(-500), position(-1)])).toEqual([]);
  });

  it("returns no alerts when every amount is non-finite", () => {
    // NaN and Infinity would poison the denominator for every bucket.
    expect(
      evaluateConcentration([
        position(Number.NaN, { debtor: "A" }),
        position(Number.POSITIVE_INFINITY, { debtor: "B" }),
      ])
    ).toEqual([]);
  });

  it("ignores non-finite amounts without dropping the finite ones", () => {
    const alerts = evaluateConcentration([
      position(Number.NaN, { debtor: "Ghost" }),
      position(1000, { debtor: "Real" }),
    ]);

    // The NaN position must not reach the denominator either: "Real" is the
    // whole portfolio, so it is 100%, not some NaN share.
    expect(alertFor(alerts, "debtor", "Ghost")).toBeUndefined();
    expect(alertFor(alerts, "debtor", "Real")!.percent).toBe(100);
  });
});

describe("evaluateConcentration — single-position portfolios", () => {
  const single = [position(5000, { debtor: "Acme", jurisdiction: "KE", riskTier: "B" })];

  it("flags all three dimensions at 100%", () => {
    const alerts = evaluateConcentration(single);

    expect(alerts).toHaveLength(3);
    expect(alerts.map((a) => a.dimension).sort()).toEqual([
      "debtor",
      "jurisdiction",
      "riskTier",
    ]);
    expect(alerts.every((a) => a.percent === 100)).toBe(true);
  });

  it("reports the single position's value in every bucket", () => {
    expect(evaluateConcentration(single).every((a) => a.value === 5000)).toBe(true);
  });

  it("names each bucket from the position's own invoice", () => {
    const alerts = evaluateConcentration(single);

    expect(alertFor(alerts, "debtor", "Acme")).toBeDefined();
    expect(alertFor(alerts, "jurisdiction", "KE")).toBeDefined();
    expect(alertFor(alerts, "riskTier", "B")).toBeDefined();
  });

  it("treats a lone position as critical on every dimension", () => {
    // 100% clears 1.5x of all three default thresholds.
    expect(evaluateConcentration(single).every((a) => a.severity === "critical")).toBe(
      true
    );
  });

  it("stays silent for a lone position when all thresholds are disabled", () => {
    expect(
      evaluateConcentration(single, { debtor: 0, jurisdiction: 0, riskTier: 0 })
    ).toEqual([]);
  });

  it("buckets a lone position with no invoice under Unknown", () => {
    const alerts = evaluateConcentration([{ investedAmount: 1000, invoice: null }]);

    expect(alerts).toHaveLength(3);
    expect(alerts.every((a) => a.name === "Unknown")).toBe(true);
  });

  it("buckets a lone position with empty metadata under Unknown", () => {
    const alerts = evaluateConcentration([{ investedAmount: 1000, invoice: {} }]);

    expect(alerts.every((a) => a.name === "Unknown")).toBe(true);
  });
});

describe("evaluateConcentration — threshold buckets", () => {
  const dimensions: Array<[ConcentrationDimension, number]> = [
    ["debtor", DEFAULT_CONCENTRATION_THRESHOLDS.debtor],
    ["jurisdiction", DEFAULT_CONCENTRATION_THRESHOLDS.jurisdiction],
    ["riskTier", DEFAULT_CONCENTRATION_THRESHOLDS.riskTier],
  ];

  for (const [dimension, threshold] of dimensions) {
    describe(dimension, () => {
      /** Build a 10,000-unit portfolio where `heavy` holds `percent` of it. */
      function atPercent(percent: number) {
        const heavy = percent * 100;
        const rest = 10_000 - heavy;
        // Split the remainder four ways so no other bucket can breach.
        return diversifiedExcept(dimension, [
          ["heavy", heavy],
          ["a", rest / 4],
          ["b", rest / 4],
          ["c", rest / 4],
          ["d", rest / 4],
        ]);
      }

      it("stays silent below the threshold", () => {
        const alerts = evaluateConcentration(atPercent(threshold - 1));
        expect(alertFor(alerts, dimension, "heavy")).toBeUndefined();
      });

      it("stays silent exactly at the threshold", () => {
        // The comparison is `percent <= threshold` — exclusive, so sitting on
        // the line is not yet a breach.
        const alerts = evaluateConcentration(atPercent(threshold));
        expect(alertFor(alerts, dimension, "heavy")).toBeUndefined();
      });

      it("warns just above the threshold", () => {
        const alerts = evaluateConcentration(atPercent(threshold + 1));
        const alert = alertFor(alerts, dimension, "heavy");

        expect(alert).toBeDefined();
        expect(alert!.severity).toBe("warning");
        expect(alert!.threshold).toBe(threshold);
        expect(alert!.percent).toBeCloseTo(threshold + 1, 6);
        expect(alert!.key).toBe(concentrationKey(dimension, "heavy"));
      });

      it("stays a warning just below 1.5x the threshold", () => {
        const alerts = evaluateConcentration(atPercent(threshold * 1.5 - 0.5));
        expect(alertFor(alerts, dimension, "heavy")!.severity).toBe("warning");
      });

      it("escalates to critical exactly at 1.5x the threshold", () => {
        // The critical comparison is `>=`, unlike the threshold's `>`.
        const alerts = evaluateConcentration(atPercent(threshold * 1.5));
        expect(alertFor(alerts, dimension, "heavy")!.severity).toBe("critical");
      });

      it("stays critical above 1.5x the threshold", () => {
        const alerts = evaluateConcentration(atPercent(threshold * 1.5 + 5));
        expect(alertFor(alerts, dimension, "heavy")!.severity).toBe("critical");
      });

      it("reports the concentrated currency value alongside the percentage", () => {
        const alerts = evaluateConcentration(atPercent(threshold + 10));
        expect(alertFor(alerts, dimension, "heavy")!.value).toBeCloseTo(
          (threshold + 10) * 100,
          6
        );
      });

      it("is disabled by a zero threshold", () => {
        const alerts = evaluateConcentration(atPercent(90), {
          ...DEFAULT_CONCENTRATION_THRESHOLDS,
          [dimension]: 0,
        });
        expect(alerts.some((a) => a.dimension === dimension)).toBe(false);
      });

      it("is disabled by a negative threshold", () => {
        const alerts = evaluateConcentration(atPercent(90), {
          ...DEFAULT_CONCENTRATION_THRESHOLDS,
          [dimension]: -10,
        });
        expect(alerts.some((a) => a.dimension === dimension)).toBe(false);
      });

      it("is disabled by a non-finite threshold", () => {
        const alerts = evaluateConcentration(atPercent(90), {
          ...DEFAULT_CONCENTRATION_THRESHOLDS,
          [dimension]: Number.NaN,
        });
        expect(alerts.some((a) => a.dimension === dimension)).toBe(false);
      });

      it("honours a custom threshold that is stricter than the default", () => {
        const alerts = evaluateConcentration(atPercent(threshold - 5), {
          ...DEFAULT_CONCENTRATION_THRESHOLDS,
          [dimension]: threshold - 10,
        });
        expect(alertFor(alerts, dimension, "heavy")!.threshold).toBe(threshold - 10);
      });
    });
  }

  it("sums every position in a bucket, not just the largest", () => {
    // Three small slices of one debtor add up past the threshold even though
    // no individual position is close to it.
    const positions = diversifiedExcept("debtor", [
      ["Acme", 1000],
      ["Acme", 1000],
      ["Acme", 1000],
      ["b", 3500],
      ["c", 3500],
    ]);

    const alert = alertFor(evaluateConcentration(positions), "debtor", "Acme");
    expect(alert!.value).toBe(3000);
    expect(alert!.percent).toBeCloseTo(30, 6);
  });

  it("flags every breaching bucket in a dimension, not only the worst", () => {
    const positions = diversifiedExcept("debtor", [
      ["Acme", 4000],
      ["Beta", 3500],
      ["Gamma", 2500],
    ]);

    const debtors = evaluateConcentration(positions).filter(
      (a) => a.dimension === "debtor"
    );
    expect(debtors.map((a) => a.name)).toEqual(["Acme", "Beta"]);
  });

  it("sorts alerts worst-first across dimensions", () => {
    const alerts = evaluateConcentration([
      position(9500, { debtor: "Acme", jurisdiction: "US", riskTier: "AAA" }),
      position(500, { debtor: "B", jurisdiction: "EU", riskTier: "BB" }),
    ]);

    const percents = alerts.map((a) => a.percent);
    expect(percents).toEqual([...percents].sort((a, b) => b - a));
  });

  it("keeps each dimension on its own threshold", () => {
    // 45% is over the debtor threshold (25) and the jurisdiction one (40) but
    // under the risk-tier threshold (50).
    const positions = [
      position(4500, { debtor: "Acme", jurisdiction: "US", riskTier: "AAA" }),
      position(2750, { debtor: "B", jurisdiction: "EU", riskTier: "AA" }),
      position(2750, { debtor: "C", jurisdiction: "UK", riskTier: "A" }),
    ];

    const alerts = evaluateConcentration(positions);
    expect(alertFor(alerts, "debtor", "Acme")).toBeDefined();
    expect(alertFor(alerts, "jurisdiction", "US")).toBeDefined();
    expect(alertFor(alerts, "riskTier", "AAA")).toBeUndefined();
  });
});

describe("filterActiveAlerts", () => {
  const alerts = evaluateConcentration([
    position(7000, { debtor: "Acme", jurisdiction: "US", riskTier: "AAA" }),
    position(3000, { debtor: "Other", jurisdiction: "EU", riskTier: "BB" }),
  ]);
  const acmeKey = concentrationKey("debtor", "Acme");

  it("returns an empty list for an empty alert list", () => {
    expect(filterActiveAlerts([], [acmeKey], [{ key: acmeKey, until: 1 }])).toEqual([]);
  });

  it("passes every alert through when nothing is dismissed or snoozed", () => {
    expect(filterActiveAlerts(alerts, [], [])).toEqual(alerts);
  });

  it("drops a dismissed alert and keeps the rest", () => {
    const remaining = filterActiveAlerts(alerts, [acmeKey], []);

    expect(remaining.some((a) => a.key === acmeKey)).toBe(false);
    expect(remaining).toHaveLength(alerts.length - 1);
  });

  it("ignores a dismissal for a key that no longer breaches", () => {
    expect(filterActiveAlerts(alerts, ["debtor:Vanished"], [])).toEqual(alerts);
  });

  it("hides a snoozed alert before its expiry", () => {
    const now = 1_000_000;
    const snoozes = [{ key: acmeKey, until: now + SNOOZE_DURATIONS_MS.day }];

    expect(filterActiveAlerts(alerts, [], snoozes, now).some((a) => a.key === acmeKey)).toBe(
      false
    );
  });

  it("shows a snoozed alert again exactly at its expiry", () => {
    const now = 1_000_000;

    expect(
      filterActiveAlerts(alerts, [], [{ key: acmeKey, until: now }], now).some(
        (a) => a.key === acmeKey
      )
    ).toBe(true);
  });

  it("keeps a dismissal winning over an already-expired snooze", () => {
    const now = 1_000_000;
    const remaining = filterActiveAlerts(
      alerts,
      [acmeKey],
      [{ key: acmeKey, until: now - 1 }],
      now
    );

    expect(remaining.some((a) => a.key === acmeKey)).toBe(false);
  });

  it("does not let one snooze hide an unrelated alert", () => {
    const remaining = filterActiveAlerts(
      alerts,
      [],
      [{ key: acmeKey, until: 2_000_000 }],
      1_000_000
    );

    expect(remaining.some((a) => a.dimension === "jurisdiction")).toBe(true);
  });
});

describe("SNOOZE_DURATIONS_MS", () => {
  it("pins the offered durations", () => {
    expect(SNOOZE_DURATIONS_MS.day).toBe(86_400_000);
    expect(SNOOZE_DURATIONS_MS.week).toBe(SNOOZE_DURATIONS_MS.day * 7);
  });
});
