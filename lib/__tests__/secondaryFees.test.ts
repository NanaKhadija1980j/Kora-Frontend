/**
 * Unit tests for `lib/secondaryFees` — Issue #805.
 *
 * Colocated with module under `lib/__tests__/` per CONTRIBUTING.md.
 * Locks basis-point math and rounded-parts totals:
 * - Basis-point conversions and cent-level rounding via applyBps.
 * - Non-finite and negative input safety without NaN leakage.
 * - Total derivation strictly through sum of rounded parts (preventing 1-cent discrepancy).
 * - Configuration clamping and rate formatting.
 */

import { describe, it, expect } from "vitest";
import {
  applyBps,
  computeAcquisitionFees,
  formatBps,
  getFeeSchedule,
  type FeeSchedule,
} from "@/lib/secondaryFees";

const DEFAULT_SCHEDULE: FeeSchedule = { protocolBps: 50, marketBps: 25 }; // 0.50% protocol + 0.25% market

describe("lib/secondaryFees - Basis-Point Math", () => {
  it("calculates exact basis-point fees for round amounts", () => {
    // 50 bps = 0.5% (50 / 10,000)
    expect(applyBps(10_000, 50)).toBe(50);
    // 25 bps = 0.25% (25 / 10,000)
    expect(applyBps(10_000, 25)).toBe(25);
    // 100 bps = 1%
    expect(applyBps(10_000, 100)).toBe(100);
    // 10,000 bps = 100%
    expect(applyBps(10_000, 10_000)).toBe(10_000);
  });

  it("applies standard Math.round half-cent rounding rules to nearest cent", () => {
    // 4850 * 50 / 10000 = 24.25
    expect(applyBps(4850, 50)).toBe(24.25);

    // 1234.56 * 25 / 10000 = 3.0864 -> 3.09
    expect(applyBps(1234.56, 25)).toBe(3.09);

    // 99.99 * 50 / 10000 = 0.49995 -> 0.5
    expect(applyBps(99.99, 50)).toBe(0.5);

    // Half-cent round up: 0.005 -> 0.01 (e.g. amount=1, bps=50 -> 0.005)
    expect(applyBps(1, 50)).toBe(0.01);

    // Sub-cent round down: 0.0049 -> 0.00 (e.g. amount=1, bps=49 -> 0.0049)
    expect(applyBps(1, 49)).toBe(0);

    // 33.33 * 33 / 10000 = 0.109989 -> 0.11
    expect(applyBps(33.33, 33)).toBe(0.11);
  });

  it.each([
    ["zero amount", 0, 50],
    ["zero bps", 1000, 0],
    ["both zero", 0, 0],
    ["negative amount", -100, 50],
    ["negative bps", 1000, -50],
    ["both negative", -100, -50],
  ])("returns 0 for %s", (_case, amount, bps) => {
    expect(applyBps(amount, bps)).toBe(0);
  });

  it("returns 0 safely without NaN for non-finite inputs", () => {
    expect(applyBps(Number.NaN, 50)).toBe(0);
    expect(applyBps(1000, Number.NaN)).toBe(0);
    expect(applyBps(Number.POSITIVE_INFINITY, 50)).toBe(0);
    expect(applyBps(1000, Number.POSITIVE_INFINITY)).toBe(0);
    expect(applyBps(Number.NEGATIVE_INFINITY, 50)).toBe(0);
  });
});

describe("lib/secondaryFees - Rounded-Parts Totals", () => {
  it("calculates breakdown with protocol, market, and combined totals", () => {
    const fees = computeAcquisitionFees(10_000, DEFAULT_SCHEDULE);

    expect(fees.subtotal).toBe(10_000);
    expect(fees.protocolFee).toBe(50);
    expect(fees.marketFee).toBe(25);
    expect(fees.totalFees).toBe(75);
    expect(fees.total).toBe(10_075);
    expect(fees.totalBps).toBe(75);
    expect(fees.schedule).toEqual({ protocolBps: 50, marketBps: 25 });
  });

  it("locks the rounded-parts invariant: parts always sum exactly to disclosed total", () => {
    // If protocolFee and marketFee were rounded independently from totalFees,
    // a 1-cent discrepancy could emerge. The module enforces totalFees = protocolFee + marketFee.
    const testPrices = [
      0.01, 0.03, 1, 7, 33.33, 49.95, 99.99, 100, 1234.56, 4850, 9999.99,
      123456.78, 1_000_000,
    ];

    const testSchedules: FeeSchedule[] = [
      { protocolBps: 50, marketBps: 25 },
      { protocolBps: 33, marketBps: 17 },
      { protocolBps: 1, marketBps: 1 },
      { protocolBps: 125, marketBps: 75 },
      { protocolBps: 0, marketBps: 25 },
      { protocolBps: 50, marketBps: 0 },
      { protocolBps: 0, marketBps: 0 },
      { protocolBps: 5000, marketBps: 5000 },
    ];

    for (const price of testPrices) {
      for (const schedule of testSchedules) {
        const fees = computeAcquisitionFees(price, schedule);

        // Sum of parts equals total fees
        const partsSum = Math.round((fees.protocolFee + fees.marketFee) * 100) / 100;
        expect(fees.totalFees).toBe(partsSum);

        // Subtotal + total fees equals final total
        const expectedTotal = Math.round((fees.subtotal + fees.totalFees) * 100) / 100;
        expect(fees.total).toBe(expectedTotal);
      }
    }
  });

  it("handles zero rates gracefully without charging fees", () => {
    const fees = computeAcquisitionFees(10_000, { protocolBps: 0, marketBps: 0 });
    expect(fees.protocolFee).toBe(0);
    expect(fees.marketFee).toBe(0);
    expect(fees.totalFees).toBe(0);
    expect(fees.total).toBe(10_000);
    expect(fees.totalBps).toBe(0);
  });

  it("clamps rates above 10,000 bps (100%) to 10,000 bps", () => {
    const fees = computeAcquisitionFees(1000, {
      protocolBps: 50_000,
      marketBps: 0,
    });
    expect(fees.schedule.protocolBps).toBe(10_000);
    expect(fees.protocolFee).toBe(1000);
    expect(fees.total).toBe(2000);
  });

  it("normalizes negative configured rates to zero", () => {
    const fees = computeAcquisitionFees(1000, {
      protocolBps: -50,
      marketBps: 25,
    });
    expect(fees.schedule.protocolBps).toBe(0);
    expect(fees.protocolFee).toBe(0);
    expect(fees.marketFee).toBe(2.5);
    expect(fees.totalFees).toBe(2.5);
    expect(fees.total).toBe(1002.5);
  });

  it("rounds non-integer configured rates to the nearest integer bps", () => {
    const fees = computeAcquisitionFees(10_000, {
      protocolBps: 50.4,
      marketBps: 24.6,
    });
    expect(fees.schedule.protocolBps).toBe(50);
    expect(fees.schedule.marketBps).toBe(25);
    expect(fees.totalBps).toBe(75);
  });

  it.each([
    ["zero price", 0],
    ["negative price", -500],
    ["NaN price", Number.NaN],
    ["Infinity price", Number.POSITIVE_INFINITY],
  ])("returns an all-zero safe breakdown for %s without NaN", (_desc, price) => {
    const fees = computeAcquisitionFees(price as number, DEFAULT_SCHEDULE);
    expect(fees.subtotal).toBe(0);
    expect(fees.protocolFee).toBe(0);
    expect(fees.marketFee).toBe(0);
    expect(fees.totalFees).toBe(0);
    expect(fees.total).toBe(0);
    expect(Number.isNaN(fees.total)).toBe(false);
  });
});

describe("lib/secondaryFees - formatBps", () => {
  it.each([
    [0, "0%"],
    [25, "0.25%"],
    [50, "0.5%"],
    [75, "0.75%"],
    [100, "1%"],
    [250, "2.5%"],
    [1000, "10%"],
    [10_000, "100%"],
  ])("formats %i bps to %s", (bps, expected) => {
    expect(formatBps(bps)).toBe(expected);
  });

  it("clamps negative bps to 0% and excess bps to 100%", () => {
    expect(formatBps(-50)).toBe("0%");
    expect(formatBps(20_000)).toBe("100%");
    expect(formatBps(Number.NaN)).toBe("0%");
  });
});

describe("lib/secondaryFees - getFeeSchedule", () => {
  it("reads and normalizes configured fee rates", () => {
    const schedule = getFeeSchedule({
      NEXT_PUBLIC_SECONDARY_PROTOCOL_FEE_BPS: 50,
      NEXT_PUBLIC_SECONDARY_MARKET_FEE_BPS: 25,
    });
    expect(schedule).toEqual({ protocolBps: 50, marketBps: 25 });
  });

  it("clamps out-of-range configuration values", () => {
    const schedule = getFeeSchedule({
      NEXT_PUBLIC_SECONDARY_PROTOCOL_FEE_BPS: 99_999,
      NEXT_PUBLIC_SECONDARY_MARKET_FEE_BPS: -10,
    });
    expect(schedule).toEqual({ protocolBps: 10_000, marketBps: 0 });
  });
});
