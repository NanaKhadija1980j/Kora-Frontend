"use client";

import React from "react";
import { Shield, MapPin, Building2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Invoice, InvoiceJurisdiction, InvoiceCategory } from "@/types/invoice";

interface DebtorDisplayProps {
  invoice: Invoice;
  isFunded?: boolean;
  className?: string;
}

const JURISDICTION_NAMES: Record<InvoiceJurisdiction, string> = {
  US: "United States",
  EU: "European Union",
  UK: "United Kingdom",
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  ZA: "South Africa",
  OTHER: "Other",
};

const CATEGORY_LABELS: Record<InvoiceCategory, string> = {
  technology: "Technology Company",
  manufacturing: "Manufacturing Company",
  logistics: "Logistics Company",
  healthcare: "Healthcare Provider",
  retail: "Retail Company",
  construction: "Construction Company",
  agriculture: "Agribusiness",
  energy: "Energy Provider",
  finance: "Financial Services",
  other: "Company",
};

export function DebtorDisplay({ invoice, isFunded = false, className }: DebtorDisplayProps) {
  const { metadata, debtorPrivacy } = invoice;
  
  // Post-fund reveal: show full info if the user has funded the invoice
  const effectivePrivacy = isFunded ? "full" : debtorPrivacy;

  const renderContent = () => {
    switch (effectivePrivacy) {
      case "full":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{metadata.debtorName}</span>
            </div>
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5" />
              <span className="leading-tight">{metadata.debtorAddress}</span>
            </div>
          </div>
        );

      case "partial":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{metadata.debtorName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              <span>Address hidden · {JURISDICTION_NAMES[metadata.jurisdiction]}</span>
            </div>
          </div>
        );

      case "anonymized":
      default:
        const anonymousLabel = `${CATEGORY_LABELS[metadata.category]}, ${JURISDICTION_NAMES[metadata.jurisdiction]}`;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Shield className="h-4 w-4 text-teal-500" />
              <span>{anonymousLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              <span>Identity anonymized for privacy</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className={cn("flex flex-col", className)}
      aria-label={`Debtor Information: ${effectivePrivacy === 'full' ? metadata.debtorName : effectivePrivacy === 'partial' ? metadata.debtorName : 'Anonymized'}`}
    >
      {renderContent()}
    </div>
  );
}
