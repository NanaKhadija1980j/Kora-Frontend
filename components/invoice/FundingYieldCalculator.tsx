"use client";

/**
 * FundingYieldCalculator — inline yield calculator for the invoice funding panel.
 *
 * Constraints:
 *  - Uses the SAME APR formula as APRDisplay: amount * (1 + (apr/100) * (days/365))
 *  - Values update with a 300ms debounce — not on every keystroke
 *  - Stale-proof: recalculates whenever `apr` or `daysToMaturity` props change
 *
 * Shows:
 *  - Expected return (total payoff at maturity)
 *  - Annualised yield (as a formatted APR)
 *  - Break-even date (the repaymentDate of the invoice)
 */

import React, { useMemo } from "react";
import { TrendingUp, Calendar, Percent } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface FundingYieldCalculatorProps {
  /** Raw investment amount string from the controlled input — may be empty */
  amountInput: string;
  /** APR in percent (e.g. 24.5 for 24.5 %) — comes from invoice.terms.apr */
  apr: number;
  /** Calendar days until repayment — derived from invoice.terms.repaymentDate */
  daysToMaturity: number;
  /** ISO 8601 repayment date for break-even display */
  repaymentDate: string;
  /** Currency label, e.g. "USDC" */
  currency: string;
  /** Optional extra className on the wrapper */
  className?: string;
}

/**
 * Core yield formula — identical to what InvoiceDetailClient uses:
 *   expectedReturn = amount * (1 + (apr / 100) * (days / 365))
 *
 * This keeps both consistent per the PR constraint.
 */
function computeYield(amount: number, apr: number, daysToMaturity: number) {
  if (amount <= 0 || apr <= 0 || daysToMaturity <= 0) {
    return { expectedReturn: 0, netYield: 0 };
  }
  const expectedReturn = amount * (1 + (apr / 100) * (daysToMaturity / 365));
  const netYield = expectedReturn - amount;
  return { expectedReturn, netYield };
}

export function FundingYieldCalculator({
  amountInput,
  apr,
  daysToMaturity,
  repaymentDate,
  currency,
  className,
}: FundingYieldCalculatorProps) {
  // Debounce the raw string to avoid computing on every keystroke
  const debouncedInput = useDebounce(amountInput, 300);
  const debouncedApr = useDebounce(apr, 300);

  const amount = useMemo(() => {
    const parsed = parseFloat(debouncedInput);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [debouncedInput]);

  const { expectedReturn, netYield } = useMemo(
    () => computeYield(amount, debouncedApr, daysToMaturity),
    [amount, debouncedApr, daysToMaturity]
  );

  if (amount <= 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-kora-500/20 bg-kora-500/5 p-4 space-y-3",
        className
      )}
      aria-label="Yield projection for your investment"
      data-testid="funding-yield-calculator"
    >
      <p className="text-xs font-semibold text-kora-400 uppercase tracking-wider">
        Yield Projection
      </p>

      {/* Expected Return */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <TrendingUp className="h-3.5 w-3.5 text-kora-400" aria-hidden="true" />
          <span>Expected Return</span>
        </div>
        <span
          className="font-mono text-sm font-semibold text-zinc-100"
          data-testid="expected-return"
        >
          {formatCurrency(expectedReturn, currency)}
        </span>
      </div>

      {/* Annualised Yield */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Percent className="h-3.5 w-3.5 text-kora-400" aria-hidden="true" />
          <span>Annualised Yield</span>
        </div>
        <span
          className="font-mono text-sm font-semibold text-kora-400"
          data-testid="annualised-yield"
        >
          {apr.toFixed(2)}% APR
        </span>
      </div>

      {/* Break-even Date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Calendar className="h-3.5 w-3.5 text-kora-400" aria-hidden="true" />
          <span>Break-even Date</span>
        </div>
        <span
          className="text-sm font-medium text-zinc-300"
          data-testid="break-even-date"
        >
          {formatDate(repaymentDate)}
        </span>
      </div>

      {/* Net Yield summary */}
      <div className="border-t border-kora-500/10 pt-2 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">Net Yield</span>
        <span
          className="font-mono text-sm font-bold text-kora-400"
          data-testid="net-yield"
        >
          +{formatCurrency(netYield, currency)}
        </span>
      </div>
    </div>
  );
}
