/**
 * Secondary market fee schedule (issue #597).
 */

import { describe, it, expect } from "vitest";
import {
  applyBps,
  computeAcquisitionFees,
  formatBps,
  getFeeSchedule,
} from "@/lib/secondaryFees";

const SCHEDULE = { protocolBps: 50, marketBps: 25 }; // 0.5% + 0.25%

describe("applyBps", () => {
  it("applies a basis-point rate", () => {
    expect(applyBps(10_000, 50)).toBe(50); // 0.5% of 10,000
    expect(applyBps(10_000, 25)).toBe(25);
  });

  it("rounds to cents", () => {
    expect(applyBps(4850, 50)).toBe(24.25);
  });

  it.each([
    ["zero amount", 0, 50],
    ["zero rate", 1000, 0],
    ["negative amount", -100, 50],
    ["negative rate", 1000, -50],
  ])("returns 0 for %s", (_label, amount, bps) => {
    expect(applyBps(amount, bps)).toBe(0);
  });

  it("never yields NaN for non-finite input", () => {
    expect(applyBps(Number.NaN, 50)).toBe(0);
    expect(applyBps(1000, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("computeAcquisitionFees", () => {
  it("breaks a price down into protocol and market fees", () => {
    const fees = computeAcquisitionFees(10_000, SCHEDULE);

    expect(fees.subtotal).toBe(10_000);
    expect(fees.protocolFee).toBe(50);
    expect(fees.marketFee).toBe(25);
    expect(fees.totalFees).toBe(75);
    expect(fees.total).toBe(10_075);
    expect(fees.totalBps).toBe(75);
  });

  it("always reconciles: the parts add up to the disclosed total", () => {
    // The property that matters for a fee *disclosure*. Rounding each figure
    // independently would let a breakdown miss its own total by a cent.
    for (const price of [4850, 1234.56, 99.99, 7, 0.03, 123456.78]) {
      const fees = computeAcquisitionFees(price, SCHEDULE);
      expect(fees.protocolFee + fees.marketFee).toBeCloseTo(fees.totalFees, 10);
      expect(fees.subtotal + fees.totalFees).toBeCloseTo(fees.total, 10);
    }
  });

  it("charges nothing when both rates are zero", () => {
    const fees = computeAcquisitionFees(10_000, { protocolBps: 0, marketBps: 0 });
    expect(fees.totalFees).toBe(0);
    expect(fees.total).toBe(10_000);
  });

  it("clamps a rate above 100% rather than charging it", () => {
    const fees = computeAcquisitionFees(1000, { protocolBps: 50_000, marketBps: 0 });
    expect(fees.schedule.protocolBps).toBe(10_000);
    expect(fees.protocolFee).toBe(1000);
  });

  it.each([
    ["zero", 0],
    ["negative", -500],
    ["NaN", Number.NaN],
  ])("returns an all-zero breakdown for a %s price instead of NaN", (_l, price) => {
    const fees = computeAcquisitionFees(price as number, SCHEDULE);
    expect(fees.subtotal).toBe(0);
    expect(fees.total).toBe(0);
    expect(Number.isNaN(fees.total)).toBe(false);
  });

  it("treats a negative configured rate as zero", () => {
    const fees = computeAcquisitionFees(1000, { protocolBps: -10, marketBps: 25 });
    expect(fees.protocolFee).toBe(0);
    expect(fees.marketFee).toBe(2.5);
  });
});

describe("formatBps", () => {
  it.each([
    [50, "0.5%"],
    [25, "0.25%"],
    [100, "1%"],
    [0, "0%"],
    [10_000, "100%"],
  ])("renders %i bps as %s", (bps, expected) => {
    expect(formatBps(bps)).toBe(expected);
  });
});

describe("getFeeSchedule", () => {
  it("reads the configured rates", () => {
    expect(
      getFeeSchedule({
        NEXT_PUBLIC_SECONDARY_PROTOCOL_FEE_BPS: 50,
        NEXT_PUBLIC_SECONDARY_MARKET_FEE_BPS: 25,
      })
    ).toEqual({ protocolBps: 50, marketBps: 25 });
  });

  it("clamps out-of-range configuration", () => {
    expect(
      getFeeSchedule({
        NEXT_PUBLIC_SECONDARY_PROTOCOL_FEE_BPS: 99_999,
        NEXT_PUBLIC_SECONDARY_MARKET_FEE_BPS: -1,
      })
    ).toEqual({ protocolBps: 10_000, marketBps: 0 });
  });
});
