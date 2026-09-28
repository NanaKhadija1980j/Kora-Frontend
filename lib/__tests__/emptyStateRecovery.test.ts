/**
 * Unit tests for lib/emptyStateRecovery.ts (#564)
 */
import { describe, it, expect } from "vitest";
import {
  deriveRecoveryActions,
  hasRestrictiveFilters,
  MAX_SUGGESTIONS,
} from "../emptyStateRecovery";
import type { FilterState } from "@/store/invoiceStore";

const DEFAULT_FILTERS: FilterState = {
  categories: [],
  jurisdictions: [],
  riskTiers: [],
  aprRange: [0, 50],
  activeOnly: false,
  showExpired: false,
};

describe("hasRestrictiveFilters", () => {
  it("returns false for default filters", () => {
    expect(hasRestrictiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it("returns true when riskTiers is set", () => {
    expect(hasRestrictiveFilters({ ...DEFAULT_FILTERS, riskTiers: ["AAA"] })).toBe(true);
  });

  it("returns true when categories is set", () => {
    expect(hasRestrictiveFilters({ ...DEFAULT_FILTERS, categories: ["technology"] })).toBe(true);
  });

  it("returns true when activeOnly is true", () => {
    expect(hasRestrictiveFilters({ ...DEFAULT_FILTERS, activeOnly: true })).toBe(true);
  });

  it("returns true when APR range is narrowed", () => {
    expect(hasRestrictiveFilters({ ...DEFAULT_FILTERS, aprRange: [5, 20] })).toBe(true);
  });
});

describe("deriveRecoveryActions", () => {
  it("returns empty array for default (no active) filters", () => {
    expect(deriveRecoveryActions(DEFAULT_FILTERS)).toHaveLength(0);
  });

  it("returns no more than MAX_SUGGESTIONS actions", () => {
    const many: FilterState = {
      ...DEFAULT_FILTERS,
      riskTiers: ["AAA"],
      categories: ["technology"],
      jurisdictions: ["KE"],
      aprRange: [5, 20],
      activeOnly: true,
    };
    expect(deriveRecoveryActions(many).length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
  });

  it("prioritises riskTiers first", () => {
    const filters: FilterState = {
      ...DEFAULT_FILTERS,
      riskTiers: ["AAA", "AA"],
      categories: ["technology"],
    };
    const actions = deriveRecoveryActions(filters);
    expect(actions[0].labelKey).toBe("clearRiskTiers");
  });

  it("returns widenApr action when APR is restricted", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, aprRange: [10, 30] };
    const actions = deriveRecoveryActions(filters);
    expect(actions.map((a) => a.labelKey)).toContain("widenApr");
  });

  it("widenApr action resets aprRange to [0, 50]", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, aprRange: [10, 30] };
    const action = deriveRecoveryActions(filters).find((a) => a.labelKey === "widenApr")!;
    const result = action.apply(filters);
    expect(result.aprRange).toEqual([0, 50]);
  });

  it("clearRiskTiers action empties riskTiers array", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, riskTiers: ["AAA", "A"] };
    const action = deriveRecoveryActions(filters).find((a) => a.labelKey === "clearRiskTiers")!;
    const result = action.apply(filters);
    expect(result.riskTiers).toEqual([]);
  });

  it("showAllStatuses action sets activeOnly to false", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, activeOnly: true };
    const action = deriveRecoveryActions(filters).find(
      (a) => a.labelKey === "showAllStatuses"
    )!;
    const result = action.apply(filters);
    expect(result.activeOnly).toBe(false);
  });

  it("does not include riskTiers action when riskTiers is empty", () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, categories: ["technology"] };
    const actions = deriveRecoveryActions(filters);
    expect(actions.map((a) => a.labelKey)).not.toContain("clearRiskTiers");
  });
});
