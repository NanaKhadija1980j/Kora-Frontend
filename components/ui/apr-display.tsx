"use client";

import React from "react";
import { Info } from "lucide-react";
import {
  calculateAPR,
  calculateRiskAdjustedReturn,
  getAPRColor,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { useFormatters } from "@/hooks/useFormatters";

interface APRDisplayProps {
  discountRate: number; // As decimal, e.g., 0.05 for 5%
  daysToMaturity: number;
  financingAmount?: number;
  riskTier?: string;
  showRiskAdjusted?: boolean;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
}

/**
 * APRDisplay component shows effective APR with color coding and tooltip explaining the calculation.
 * Used in InvoiceCard, marketplace detail, and dashboards.
 */
export function APRDisplay({
  discountRate,
  daysToMaturity,
  financingAmount,
  riskTier,
  showRiskAdjusted = false,
  size = "md",
}: APRDisplayProps) {
  const { formatApr, formatCurrency, formatPercentage } = useFormatters();
  const apr = calculateAPR(discountRate, daysToMaturity);
  const riskAdjustedApr = riskTier ? calculateRiskAdjustedReturn(apr, riskTier) : apr;
  const displayApr = showRiskAdjusted ? riskAdjustedApr : apr;
  const aprColor = getAPRColor(displayApr);

  const discountAmt = financingAmount != null ? financingAmount * discountRate : null;

  const sizeClasses = { sm: "text-sm", md: "text-base", lg: "text-lg" };

  const tooltipContent = (
    <div className="space-y-1.5">
      <p className="font-semibold text-xs">APR Calculation</p>
      <p className="text-[11px] text-muted-foreground font-mono">
        APR = (discount / financing amount) × (365 / days to maturity) × 100
      </p>
      <div className="border-t border-border pt-1.5 text-[11px] space-y-0.5">
        <div>Discount rate: <span className="font-semibold">{formatPercentage(discountRate * 100, 2)}</span></div>
        {discountAmt != null && (
          <div>Discount amount: <span className="font-semibold">{formatCurrency(discountAmt, "USDC")}</span></div>
        )}
        {financingAmount != null && (
          <div>Financing amount: <span className="font-semibold">{formatCurrency(financingAmount, "USDC")}</span></div>
        )}
        <div>Days to maturity: <span className="font-semibold">{daysToMaturity}</span></div>
        <div className="pt-1 border-t border-border">
          Result: <span className={cn("font-bold", aprColor)}>{formatApr(displayApr)}</span>
        </div>
        {riskTier && showRiskAdjusted && (
          <div>Risk-adjusted ({riskTier}): <span className="font-bold">{formatApr(riskAdjustedApr)}</span></div>
        )}
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} side="bottom" contentClassName="max-w-[220px]">
      <div className="flex items-center gap-1 cursor-help">
        <span className={cn("font-semibold", sizeClasses[size], aprColor)}>
          {formatApr(displayApr)}
        </span>
        <Info className="w-4 h-4 text-muted-foreground" />
      </div>
    </Tooltip>
  );
}
