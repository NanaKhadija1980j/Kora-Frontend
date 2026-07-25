"use client";

import React, { useMemo } from "react";
import useCountdown from "@/hooks/useCountdown";

type Props = {
  targetDate: string | Date | number;
  className?: string;
  compact?: boolean; // when true, shows abbreviated like '14d 6h 32m'
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

export function CountdownTimer({ targetDate, className = "", compact = true }: Props) {
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

  if (isExpired) {
    return (
      <span className={`inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive ${className}`}>
        Expired
      </span>
    );
  }

  if (compact) {
    if (days === 0) {
      // less than 24h
      return <span className={`${labelClass} ${className} font-semibold`}>Expires today</span>;
    }
    return (
      <span className={`flex items-center gap-2 ${className}`}>
        <span className={`${labelClass} font-semibold`}>{pad(days)}d</span>
        <span className="text-sm text-muted-foreground">{pad(hours)}h</span>
        <span className="text-sm text-muted-foreground">{pad(minutes)}m</span>
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
      <span className="sr-only" aria-live="polite">{announce ?? ""}</span>
    </div>
  );
}

export default CountdownTimer;
