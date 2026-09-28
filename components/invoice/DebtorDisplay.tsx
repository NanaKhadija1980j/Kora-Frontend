"use client";

import React from "react";
import { Shield, MapPin, Building2, Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  getEffectiveDebtorPrivacy,
  getMaskedDebtorName,
  getMaskedDebtorAddress,
  getDebtorAriaLabel,
} from "@/lib/debtorPrivacy";
import type { Invoice } from "@/types/invoice";

export interface DebtorDisplayProps {
  invoice: Partial<Invoice>;
  isFunded?: boolean;
  variant?: "card" | "row" | "compact" | "detail";
  showPrivacyBadge?: boolean;
  className?: string;
}

export function DebtorDisplay({
  invoice,
  isFunded = false,
  variant = "card",
  showPrivacyBadge = false,
  className,
}: DebtorDisplayProps) {
  const effectivePrivacy = getEffectiveDebtorPrivacy(invoice, isFunded);
  const maskedName = getMaskedDebtorName(invoice, isFunded);
  const maskedAddress = getMaskedDebtorAddress(invoice, isFunded);
  const ariaLabel = getDebtorAriaLabel(invoice, isFunded);

  if (variant === "compact") {
    return (
      <div
        className={cn("flex items-center gap-1.5 min-w-0", className)}
        aria-label={ariaLabel}
      >
        {effectivePrivacy === "anonymized" ? (
          <Shield className="h-3.5 w-3.5 shrink-0 text-teal-500" />
        ) : effectivePrivacy === "partial" ? (
          <Building2 className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : (
          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
        )}
        <span className="truncate text-xs font-semibold text-foreground">
          {maskedName}
        </span>
        {showPrivacyBadge && (
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] px-1 py-0 border-border shrink-0",
              effectivePrivacy === "anonymized"
                ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                : effectivePrivacy === "partial"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                : "bg-muted/40 text-muted-foreground"
            )}
          >
            {effectivePrivacy}
          </Badge>
        )}
      </div>
    );
  }

  const renderContent = () => {
    switch (effectivePrivacy) {
      case "full":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{maskedName}</span>
              {showPrivacyBadge && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/40 text-muted-foreground">
                  Full Disclosure
                </Badge>
              )}
            </div>
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="leading-tight break-words">{maskedAddress}</span>
            </div>
          </div>
        );

      case "partial":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Building2 className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="truncate">{maskedName}</span>
              {showPrivacyBadge && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                >
                  Partial Privacy
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
              <span>{maskedAddress}</span>
            </div>
          </div>
        );

      case "anonymized":
      default:
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Shield className="h-4 w-4 text-teal-500 shrink-0" />
              <span className="truncate">{maskedName}</span>
              {showPrivacyBadge && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                >
                  Anonymized
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0 text-teal-500/70" />
              <span>{maskedAddress}</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={cn("flex flex-col", className)} aria-label={ariaLabel}>
      {renderContent()}
    </div>
  );
}
