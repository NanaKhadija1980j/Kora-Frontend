/**
 * Empty-state recovery suggestion builder (#564).
 *
 * When marketplace filters yield zero results, this module analyses the active
 * filters and returns up to 3 one-click "relax" actions that are most likely
 * to surface results. The caller (marketplace page) wires each action to the
 * Zustand store updater so a single click immediately re-runs the query.
 *
 * Priority order (highest impact first):
 *  1. Clear all risk tiers (often the most restrictive selector)
 *  2. Widen APR range to default (0–50 %)
 *  3. Clear jurisdiction filters
 *  4. Clear category filters
 *  5. Disable activeOnly toggle
 *
 * No more than MAX_SUGGESTIONS are returned so the UI never overflows.
 */

import type { FilterState } from "@/store/invoiceStore";

/** Maximum number of suggestions to surface at once. */
export const MAX_SUGGESTIONS = 3;

export interface RecoveryAction {
  /**
   * i18n key (relative to the "marketplace.recovery" namespace).
   * The marketplace page looks this up via `t("recovery.${labelKey}")`.
   */
  labelKey: string;
  /** The filter mutation to apply when the user clicks the chip. */
  apply: (current: FilterState) => Partial<FilterState>;
}

/**
 * Derive up to MAX_SUGGESTIONS recovery actions from the active filter state.
 *
 * Returns an empty array when no filters are active (the empty state must have
 * another cause such as an empty indexer response) or when no relaxation would
 * logically help.
 */
export function deriveRecoveryActions(filters: FilterState): RecoveryAction[] {
  const actions: RecoveryAction[] = [];

  // 1. Risk tiers — very selective; clearing opens the widest range of invoices
  if (filters.riskTiers.length > 0) {
    actions.push({
      labelKey: "clearRiskTiers",
      apply: () => ({ riskTiers: [] }),
    });
  }

  // 2. APR range — non-default range can exclude many invoices
  const [minApr, maxApr] = filters.aprRange;
  if (minApr > 0 || maxApr < 50) {
    actions.push({
      labelKey: "widenApr",
      apply: () => ({ aprRange: [0, 50] as [number, number] }),
    });
  }

  // 3. Jurisdiction filters — multi-select that can be too specific
  if (filters.jurisdictions.length > 0) {
    actions.push({
      labelKey: "clearJurisdictions",
      apply: () => ({ jurisdictions: [] }),
    });
  }

  // 4. Category filters
  if (filters.categories.length > 0) {
    actions.push({
      labelKey: "clearCategories",
      apply: () => ({ categories: [] }),
    });
  }

  // 5. Active-only toggle
  if (filters.activeOnly) {
    actions.push({
      labelKey: "showAllStatuses",
      apply: () => ({ activeOnly: false }),
    });
  }

  return actions.slice(0, MAX_SUGGESTIONS);
}

/**
 * Returns `true` when any filter is in a non-default state that could
 * explain zero results.  Use this to decide whether to show suggestions
 * vs. a plain "no inventory" message.
 */
export function hasRestrictiveFilters(filters: FilterState): boolean {
  return (
    filters.riskTiers.length > 0 ||
    filters.categories.length > 0 ||
    filters.jurisdictions.length > 0 ||
    filters.aprRange[0] > 0 ||
    filters.aprRange[1] < 50 ||
    filters.activeOnly
  );
}
