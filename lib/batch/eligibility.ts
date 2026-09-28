import type { Invoice } from "@/types";

/** Align batch cancel eligibility with single-invoice cancel. */
export function isBatchCancelEligible(inv: Invoice): boolean {
  return (
    (inv.status === "listed" || inv.status === "pending_mint") &&
    inv.funding.totalRaised === 0
  );
}

/** Align batch repay eligibility with single-invoice repay. */
export function isBatchRepayEligible(inv: Invoice, now = new Date()): boolean {
  if (inv.status !== "fully_funded") return false;
  const due = new Date(inv.terms.repaymentDate || inv.metadata.dueDate).getTime();
  return !Number.isNaN(due) && due <= now.getTime();
}
