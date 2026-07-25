/**
 * Invoice status state machine.
 *
 * On-chain enum indices (must match the Soroban contract):
 *   0 = pending_mint
 *   1 = listed        (UI: "Active")
 *   2 = partially_funded
 *   3 = fully_funded  (UI: "Funded")
 *   4 = active
 *   5 = repaid
 *   6 = defaulted
 *   7 = cancelled
 *
 * Allowed SME-triggered transitions (owner-only):
 *   listed        → fully_funded  ("Mark as Funded")
 *   partially_funded → fully_funded ("Mark as Funded")
 *   fully_funded  → repaid        ("Mark as Repaid")
 *   active        → repaid        ("Mark as Repaid")
 *   listed        → cancelled     ("Cancel")
 *   partially_funded → cancelled  ("Cancel")
 */

import type { InvoiceStatus } from "@/types/invoice";

// ─── On-chain enum index map ──────────────────────────────────────────────────

export const STATUS_TO_CHAIN_INDEX: Record<InvoiceStatus, number> = {
  draft: -1, // not a real on-chain state
  pending_mint: 0,
  listed: 1,
  partially_funded: 2,
  fully_funded: 3,
  active: 4,
  repaid: 5,
  defaulted: 6,
  cancelled: 7,
};

// ─── Transition definition ────────────────────────────────────────────────────

export interface StatusTransition {
  /** The target status after this transition. */
  to: InvoiceStatus;
  /** Short label for the action button. */
  label: string;
  /** Variant used on the Button component. */
  variant: "default" | "destructive" | "outline";
  /** Human-readable description shown in tooltips and confirmation dialogs. */
  description: string;
}

/**
 * Defines the valid transitions an SME (owner) can trigger from each status.
 * Any transition not listed here is blocked client-side.
 */
const TRANSITIONS: Partial<Record<InvoiceStatus, StatusTransition[]>> = {
  listed: [
    {
      to: "fully_funded",
      label: "Mark as Funded",
      variant: "default",
      description: "Marks this invoice as fully funded. Investors will be notified.",
    },
    {
      to: "cancelled",
      label: "Cancel Invoice",
      variant: "destructive",
      description: "Cancels this invoice and refunds any invested amount.",
    },
  ],
  partially_funded: [
    {
      to: "fully_funded",
      label: "Mark as Funded",
      variant: "default",
      description: "Marks this invoice as fully funded. Investors will be notified.",
    },
    {
      to: "cancelled",
      label: "Cancel Invoice",
      variant: "destructive",
      description: "Cancels this invoice and refunds any invested amount.",
    },
  ],
  fully_funded: [
    {
      to: "repaid",
      label: "Mark as Repaid",
      variant: "default",
      description: "Marks repayment complete and triggers yield distribution to investors.",
    },
  ],
  active: [
    {
      to: "repaid",
      label: "Mark as Repaid",
      variant: "default",
      description: "Marks repayment complete and triggers yield distribution to investors.",
    },
  ],
};

/**
 * Returns the list of allowed transitions from a given status.
 * Terminal states (repaid, defaulted, cancelled, pending_mint, draft) return [].
 */
export function getAllowedTransitions(from: InvoiceStatus): StatusTransition[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Returns true if the transition from → to is valid per the state machine.
 */
export function isValidTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return getAllowedTransitions(from).some((t) => t.to === to);
}

/**
 * Returns a human-readable reason why a transition is blocked.
 * Returns null when the transition is allowed.
 */
export function getBlockedReason(
  from: InvoiceStatus,
  to: InvoiceStatus,
  isOwner: boolean
): string | null {
  if (!isOwner) {
    return "Only the invoice owner can trigger status changes.";
  }
  if (!isValidTransition(from, to)) {
    return `Cannot transition from "${from}" to "${to}".`;
  }
  return null;
}
