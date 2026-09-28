import { describe, expect, it } from "vitest";

import {
  clampFundingAmount,
  computeRemainingCapacity,
  evaluateFundingAmount,
  leavesDustRemainder,
  maxFundableAmount,
  type FundingLimits,
} from "../partialFill";

const limits = (overrides: Partial<FundingLimits> = {}): FundingLimits => ({
  remainingCapacity: 10_000,
  minTicket: 1_000,
  ...overrides,
});

describe("computeRemainingCapacity", () => {
  it("subtracts raised from financing amount", () => {
    expect(computeRemainingCapacity(50_000, 12_500)).toBe(37_500);
  });

  it("never goes negative on over-funding", () => {
    expect(computeRemainingCapacity(50_000, 51_000)).toBe(0);
  });

  it("returns 0 for non-finite inputs", () => {
    expect(computeRemainingCapacity(Number.NaN, 10)).toBe(0);
  });
});

describe("maxFundableAmount", () => {
  it("defaults to remaining capacity", () => {
    expect(maxFundableAmount(limits())).toBe(10_000);
  });

  it("is bounded by max ticket and balance", () => {
    expect(maxFundableAmount(limits({ maxTicket: 5_000 }))).toBe(5_000);
    expect(maxFundableAmount(limits({ maxTicket: 5_000, availableBalance: 2_500 }))).toBe(2_500);
  });

  it("ignores an unknown balance", () => {
    expect(maxFundableAmount(limits({ availableBalance: null }))).toBe(10_000);
  });
});

describe("clampFundingAmount", () => {
  it("clamps to the fundable ceiling", () => {
    expect(clampFundingAmount(99_000, limits())).toBe(10_000);
  });

  it("raises a too-small amount to the min ticket", () => {
    expect(clampFundingAmount(10, limits())).toBe(1_000);
  });

  it("never exceeds the ceiling when capacity is below the min ticket", () => {
    expect(clampFundingAmount(900, limits({ remainingCapacity: 400 }))).toBe(400);
  });

  it("returns 0 when nothing is fundable", () => {
    expect(clampFundingAmount(500, limits({ remainingCapacity: 0 }))).toBe(0);
    expect(clampFundingAmount(Number.NaN, limits())).toBe(0);
  });
});

describe("leavesDustRemainder", () => {
  it("flags a remainder smaller than the min ticket", () => {
    expect(leavesDustRemainder(9_500, limits())).toBe(true);
  });

  it("allows an exact full fill", () => {
    expect(leavesDustRemainder(10_000, limits())).toBe(false);
  });

  it("allows a remainder of exactly the min ticket", () => {
    expect(leavesDustRemainder(9_000, limits())).toBe(false);
  });
});

describe("evaluateFundingAmount", () => {
  it("accepts a valid ticket", () => {
    expect(evaluateFundingAmount("2500", limits())).toEqual({
      ok: true,
      amount: 2_500,
    });
  });

  it("accepts an exact full fill", () => {
    expect(evaluateFundingAmount(10_000, limits()).ok).toBe(true);
  });

  it("rejects non-numeric input", () => {
    expect(evaluateFundingAmount("abc", limits())).toMatchObject({
      ok: false,
      reason: "invalid",
      messageKey: "invalidAmount",
    });
  });

  it("rejects zero and negative amounts", () => {
    expect(evaluateFundingAmount(0, limits()).reason).toBe("notPositive");
    expect(evaluateFundingAmount(-100, limits()).reason).toBe("notPositive");
  });

  it("rejects below the min ticket with the min in values", () => {
    expect(evaluateFundingAmount(999, limits())).toMatchObject({
      reason: "belowMinTicket",
      messageKey: "minInvestment",
      values: { amount: 1_000 },
    });
  });

  it("rejects above the remaining capacity", () => {
    expect(evaluateFundingAmount(10_001, limits())).toMatchObject({
      reason: "exceedsCapacity",
      values: { amount: 10_000 },
    });
  });

  it("rejects above the max ticket", () => {
    expect(evaluateFundingAmount(6_000, limits({ maxTicket: 5_000 }))).toMatchObject({
      reason: "aboveMaxTicket",
      messageKey: "maxInvestment",
      values: { amount: 5_000 },
    });
  });

  it("rejects a fill that would leave dust", () => {
    expect(evaluateFundingAmount(9_500, limits())).toMatchObject({
      reason: "dustRemainder",
      values: { amount: 10_000, min: 1_000 },
    });
  });

  it("rejects an amount above the wallet balance", () => {
    expect(evaluateFundingAmount(5_000, limits({ availableBalance: 4_999 }))).toMatchObject({
      reason: "insufficientBalance",
      values: { amount: 4_999 },
    });
  });

  it("skips the balance check while the balance is unknown", () => {
    expect(evaluateFundingAmount(5_000, limits({ availableBalance: null })).ok).toBe(true);
  });

  it("reports capacity before balance when both fail", () => {
    expect(evaluateFundingAmount(20_000, limits({ availableBalance: 100 })).reason).toBe(
      "exceedsCapacity"
    );
  });

  it("tolerates 2-decimal float drift on an exact full fill", () => {
    const l = limits({ remainingCapacity: 0.1 + 0.2, minTicket: 0.01 });
    expect(evaluateFundingAmount(0.3, l).ok).toBe(true);
  });
});
