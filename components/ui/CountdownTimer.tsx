"use client";

import React, { useMemo } from "react";
import useCountdown from "@/hooks/useCountdown";
import { Calendar } from "lucide-react";
import { exportInvoiceCalendarIcs } from "@/lib/export";

type Props = {
  targetDate: string | Date | number;
  className?: string;
  compact?: boolean; // when true, shows abbreviated like '14d 6h 32m'
  invoice?: {
    id: string;
    metadata: { invoiceNumber: string; debtorName?: string; amount: number; currency: string };
    terms: { repaymentDate: string; apr: number };
  };
  showCalendarExport?: boolean;
  /**
   * Text for the elapsed state. Defaults to "Expired", which reads correctly
   * for a listing that has come off the marketplace; a maturity countdown
   * passes "Overdue" instead, since the invoice still exists — it is late.
   */
  expiredLabel?: string;
};

function pad(n: number) {
  return String(n);
}

function Digit({ value, prev }: { value: string; prev?: string }) {
  // Flip animation when value !== prev
  const flipped = prev !== undefined && prev !== value;
  return (
    <span className="inline-flex items-center">
      <span className={`relative inline-block h-6 w-auto overflow-hidden`}> 
        <span
          className={`block transform transition-transform origin-top ${flipped ? "-translate-y-full" : "translate-y-0"}`}
          aria-hidden
        >
          {value}
        </span>
      </span>
    </span>
  );
}

export function CountdownTimer({
  targetDate,
  className = "",
  compact = true,
  invoice,
  showCalendarExport = false,
  expiredLabel = "Expired",
}: Props) {
  const { days, hours, minutes, isExpired, urgency, announce } = useCountdown(targetDate);

  const labelClass = useMemo(() => {
    switch (urgency) {
      case "warning":
        return "text-amber-400";
      case "urgent":
        return "text-destructive";
      case "expired":
        return "text-destructive";
      default:
        return "text-emerald-400";
    }
  }, [urgency]);

  const handleExportCalendar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (invoice) {
      exportInvoiceCalendarIcs(invoice);
    } else {
      // Fallback object if invoice not provided
      exportInvoiceCalendarIcs({
        id: String(targetDate),
        metadata: {
          invoiceNumber: "INV-MATURITY",
          amount: 0,
          currency: "USDC",
        },
        terms: {
          repaymentDate: new Date(targetDate).toISOString(),
          apr: 0,
        },
      });
    }
  };

  if (isExpired) {
    return (
      <span
        role="status"
        data-state="expired"
        className={`inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive ${className}`}
      >
        {expiredLabel}
      </span>
    );
  }

  if (compact) {
    if (days === 0) {
      // less than 24h
      return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
          <span className={`${labelClass} font-semibold`}>Expires today</span>
          {showCalendarExport && (
            <button
              type="button"
              onClick={handleExportCalendar}
              title="Export maturity date to Calendar (.ics)"
              className="text-zinc-400 hover:text-primary transition-colors"
              aria-label="Export maturity date to calendar"
            >
              <Calendar className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      );
    }
    return (
      <span className={`flex items-center gap-2 ${className}`}>
        <span className={`${labelClass} font-semibold`}>{pad(days)}d</span>
        <span className="text-sm text-muted-foreground">{pad(hours)}h</span>
        <span className="text-sm text-muted-foreground">{pad(minutes)}m</span>
        {showCalendarExport && (
          <button
            type="button"
            onClick={handleExportCalendar}
            title="Export maturity date to Calendar (.ics)"
            className="ml-1 text-zinc-400 hover:text-primary transition-colors"
            aria-label="Export maturity date to calendar"
          >
            <Calendar className="h-3.5 w-3.5" />
          </button>
        )}
        {/* Accessible announce region */}
        <span className="sr-only" aria-live="polite">{announce ?? ""}</span>
      </span>
    );
  }

  // Expanded view with simple per-digit flip (minimal)
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-baseline gap-1">
        <Digit value={`${days}d`} />
        <span className="text-sm text-muted-foreground">days</span>
      </div>
      <div className="flex items-baseline gap-1">
        <Digit value={`${hours}h`} />
        <span className="text-sm text-muted-foreground">hours</span>
      </div>
      <div className="flex items-baseline gap-1">
        <Digit value={`${minutes}m`} />
        <span className="text-sm text-muted-foreground">minutes</span>
      </div>
      {showCalendarExport && (
        <button
          type="button"
          onClick={handleExportCalendar}
          title="Export maturity date to Calendar (.ics)"
          className="ml-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          aria-label="Export maturity date to calendar"
        >
          <Calendar className="h-3.5 w-3.5" />
          ICS
        </button>
      )}
      <span className="sr-only" aria-live="polite">{announce ?? ""}</span>
    </div>
  );
}

export default CountdownTimer;

