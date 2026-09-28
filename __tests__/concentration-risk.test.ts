/**
 * Portfolio concentration risk alerts (issue #604).
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONCENTRATION_THRESHOLDS,
  SNOOZE_DURATIONS_MS,
  concentrationKey,
  evaluateConcentration,
  filterActiveAlerts,
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

describe("evaluateConcentration", () => {
  it("returns nothing for an empty portfolio", () => {
    expect(evaluateConcentration([])).toEqual([]);
  });

  it("returns nothing when every bucket is under threshold", () => {
    // Four debtors at 25% each — at, not above, the debtor threshold.
    const positions = ["A", "B", "C", "D"].map((d, i) =>
      position(1000, {
        debtor: d,
        jurisdiction: ["US", "EU", "UK", "NG"][i],
        riskTier: ["AAA", "AA", "A", "BBB"][i],
      })
    );

    expect(evaluateConcentration(positions)).toEqual([]);
  });

  it("flags a single debtor above the threshold", () => {
    const positions = [
      position(7000, { debtor: "Acme", jurisdiction: "US" }),
      position(3000, { debtor: "Other", jurisdiction: "EU" }),
    ];

    const alerts = evaluateConcentration(positions);
    const debtor = alerts.find((a) => a.dimension === "debtor");

    expect(debtor).toBeDefined();
    expect(debtor!.name).toBe("Acme");
    expect(debtor!.percent).toBeCloseTo(70, 5);
    expect(debtor!.value).toBe(7000);
  });

  it("is exclusive at the boundary — exactly at threshold does not alert", () => {
    // 25% debtor threshold; this debtor is exactly 25%.
    const positions = [
      position(2500, { debtor: "Acme" }),
      position(2500, { debtor: "B" }),
      position(2500, { debtor: "C" }),
      position(2500, { debtor: "D" }),
    ];

    expect(
      evaluateConcentration(positions).some((a) => a.dimension === "debtor")
    ).toBe(false);
  });

  it("escalates to critical at 1.5x the threshold", () => {
    const positions = [
      position(9000, { debtor: "Acme" }),
      position(1000, { debtor: "Other" }),
    ];

    const debtor = evaluateConcentration(positions).find(
      (a) => a.dimension === "debtor"
    );
    // 90% >= 25 * 1.5
    expect(debtor!.severity).toBe("critical");
  });

  it("stays a warning just below the critical multiple", () => {
    const positions = [
      position(3000, { debtor: "Acme" }),
      position(7000, { debtor: "Other" }),
    ];
    // Alerts are sorted worst-first, so select the bucket by name rather than
    // taking the first debtor alert — "Other" at 70% is also present.
    const acme = evaluateConcentration(positions).find(
      (a) => a.dimension === "debtor" && a.name === "Acme"
    );
    // 30% is over the 25 threshold but under the 37.5 critical multiple.
    expect(acme!.severity).toBe("warning");
  });

  it("flags jurisdiction and risk tier on their own thresholds", () => {
    const positions = [
      position(6000, { debtor: "A", jurisdiction: "US", riskTier: "AAA" }),
      position(4000, { debtor: "B", jurisdiction: "US", riskTier: "AAA" }),
    ];

    const alerts = evaluateConcentration(positions);
    // 100% in one jurisdiction (>40) and one tier (>50)
    expect(alerts.some((a) => a.dimension === "jurisdiction")).toBe(true);
    expect(alerts.some((a) => a.dimension === "riskTier")).toBe(true);
  });

  it("sorts the worst concentration first", () => {
    const positions = [
      position(9500, { debtor: "Acme", jurisdiction: "US", riskTier: "AAA" }),
      position(500, { debtor: "B", jurisdiction: "EU", riskTier: "BB" }),
    ];

    const alerts = evaluateConcentration(positions);
    for (let i = 1; i < alerts.length; i++) {
      expect(alerts[i - 1].percent).toBeGreaterThanOrEqual(alerts[i].percent);
    }
  });

  it("ignores positions with no invested amount", () => {
    const positions = [
      position(0, { debtor: "Ghost" }),
      position(-100, { debtor: "Negative" }),
      position(1000, { debtor: "Real" }),
    ];

    const alerts = evaluateConcentration(positions);
    expect(alerts.every((a) => a.name !== "Ghost")).toBe(true);
    expect(alerts.every((a) => a.name !== "Negative")).toBe(true);
  });

  it("buckets missing metadata under Unknown rather than dropping it", () => {
    const positions: ConcentrationPosition[] = [
      { investedAmount: 9000, invoice: null },
      position(1000, { debtor: "Real" }),
    ];

    const alerts = evaluateConcentration(positions);
    expect(alerts.some((a) => a.name === "Unknown")).toBe(true);
  });

  it("treats a zero threshold as disabling that dimension", () => {
    const positions = [
      position(9000, { debtor: "Acme" }),
      position(1000, { debtor: "Other" }),
    ];

    const alerts = evaluateConcentration(positions, {
      ...DEFAULT_CONCENTRATION_THRESHOLDS,
      debtor: 0,
    });

    expect(alerts.some((a) => a.dimension === "debtor")).toBe(false);
  });

  it("honours custom thresholds", () => {
    const positions = [
      position(3000, { debtor: "Acme" }),
      position(7000, { debtor: "Other" }),
    ];

    const strict = evaluateConcentration(positions, {
      ...DEFAULT_CONCENTRATION_THRESHOLDS,
      debtor: 10,
    });
    expect(strict.filter((a) => a.dimension === "debtor")).toHaveLength(2);
  });

  it("keys alerts by dimension and bucket, not by percentage", () => {
    // A dismissal must survive the number moving.
    const first = evaluateConcentration([
      position(7000, { debtor: "Acme" }),
      position(3000, { debtor: "B" }),
    ]).find((a) => a.dimension === "debtor")!;

    const later = evaluateConcentration([
      position(8000, { debtor: "Acme" }),
      position(2000, { debtor: "B" }),
    ]).find((a) => a.dimension === "debtor")!;

    expect(first.key).toBe(later.key);
    expect(first.percent).not.toBe(later.percent);
  });
});

describe("filterActiveAlerts", () => {
  const alerts = evaluateConcentration([
    position(7000, { debtor: "Acme" }),
    position(3000, { debtor: "Other" }),
  ]);

  it("passes everything through by default", () => {
    expect(filterActiveAlerts(alerts, [], [])).toHaveLength(alerts.length);
  });

  it("drops a dismissed alert", () => {
    const key = concentrationKey("debtor", "Acme");
    const remaining = filterActiveAlerts(alerts, [key], []);
    expect(remaining.some((a) => a.key === key)).toBe(false);
  });

  it("hides a snoozed alert until its expiry", () => {
    const key = concentrationKey("debtor", "Acme");
    const now = 1_000_000;
    const snoozes = [{ key, until: now + SNOOZE_DURATIONS_MS.day }];

    expect(filterActiveAlerts(alerts, [], snoozes, now).some((a) => a.key === key)).toBe(
      false
    );
  });

  it("shows it again once the snooze expires", () => {
    const key = concentrationKey("debtor", "Acme");
    const now = 1_000_000;
    const snoozes = [{ key, until: now }];

    // Boundary: at `until` the snooze is over.
    expect(filterActiveAlerts(alerts, [], snoozes, now).some((a) => a.key === key)).toBe(
      true
    );
  });

  it("does not let one snooze hide an unrelated alert", () => {
    const snoozes = [{ key: concentrationKey("debtor", "Acme"), until: 2_000_000 }];
    const remaining = filterActiveAlerts(alerts, [], snoozes, 1_000_000);
    expect(remaining.some((a) => a.dimension === "jurisdiction")).toBe(true);
  });
});
