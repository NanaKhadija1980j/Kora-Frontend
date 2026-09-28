"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { TrendingUp, MapPin, Calendar, Zap, Info, CircleAlert } from "lucide-react";
import { daysUntil } from "@/lib/utils";
import { useFormatters } from "@/hooks/useFormatters";
import type { Invoice } from "@/types";

interface InvoiceCardHoverPopoverProps {
  invoice: Invoice;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
  /** Optional: fired when the popover opens so callers can prefetch detail data. */
  onPrefetch?: (invoiceId: string) => void;
}

const JURISDICTION_NAMES: Record<string, string> = {
  KE: "Kenya",
  NG: "Nigeria",
  GH: "Ghana",
  ZA: "South Africa",
  US: "United States",
  EU: "European Union",
  UK: "United Kingdom",
};

/**
 * InvoiceCardHoverPopover — Desktop-only hover/focus popover for invoice previews.
 *
 * - Desktop only (no touch support)
 * - Shows on 300ms hover delay + keyboard focus
 * - Closes on Escape + blur
 * - Keyboard: Enter/Space to open on focus (if not already open), Escape to close
 * - Accessible: role="tooltip", aria-describedby linkage
 * - No layout shift
 *
 * Displays:
 *  - APR (Annual Percentage Rate)
 *  - Risk Tier with description
 *  - Jurisdiction
 *  - Funded %
 *  - Days to Maturity
 */
export function InvoiceCardHoverPopover({
  invoice,
  isOpen,
  onOpenChange,
  triggerRef,
  onPrefetch,
}: InvoiceCardHoverPopoverProps) {
  const { terms, funding, riskTier, metadata } = invoice;
  const { formatApr, formatDate } = useFormatters();
  const popoverRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Detect touch device on mount
  useEffect(() => {
    const isTouchSupported = () => {
      return (
        typeof window !== "undefined" &&
        ("ontouchstart" in window ||
          (navigator as any).maxTouchPoints > 0 ||
          (navigator as any).msMaxTouchPoints > 0)
      );
    };
    setIsTouchDevice(isTouchSupported());
  }, []);

  // Notify parent when popover opens so marketplace can prefetch detail data.
  // Desktop uses the hover/focus path; touch uses the explicit quick-stats control.
  useEffect(() => {
    if (isOpen || isMobileOpen) {
      onPrefetch?.(invoice.id);
    }
  }, [isMobileOpen, isOpen, invoice.id, onPrefetch]);

  // Close popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onOpenChange(false);
        // Return focus to trigger
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onOpenChange, triggerRef]);

  // Update popover position when open or trigger ref changes
  useEffect(() => {
    const isPopoverOpen = isTouchDevice ? isMobileOpen : isOpen;
    if (!isPopoverOpen || !triggerRef.current || !popoverRef.current) return;

    const updatePosition = () => {
      const triggerRect = triggerRef.current!.getBoundingClientRect();
      const popoverRect = popoverRef.current!.getBoundingClientRect();
      const gap = 8;

      // Position popover to the right of trigger
      // Fallback to left if not enough space on right
      let left = triggerRect.right + gap + window.scrollX;
      if (left + popoverRect.width > window.innerWidth - 16) {
        left = triggerRect.left - popoverRect.width - gap + window.scrollX;
      }

      // Center vertically on trigger
      let top = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2 + window.scrollY;
      
      // Keep within viewport
      if (top < window.scrollY + 8) {
        top = window.scrollY + 8;
      }
      if (top + popoverRect.height > window.innerHeight + window.scrollY - 8) {
        top = window.innerHeight + window.scrollY - popoverRect.height - 8;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isMobileOpen, isOpen, isTouchDevice, triggerRef]);

  const jurisdictionName = JURISDICTION_NAMES[metadata.jurisdiction] || metadata.jurisdiction;
  const fundedPercent = Math.round((funding.fundingProgress || 0) * 100);
  const daysToMaturity = daysUntil(terms.repaymentDate);

  const popoverId = `invoice-popover-${invoice.id}`;
  const shouldRenderPopover = isTouchDevice ? isMobileOpen : isOpen;

  return (
    <>
      {isTouchDevice ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPrefetch?.(invoice.id);
            setIsMobileOpen((prev) => !prev);
          }}
          className="absolute right-3 top-3 z-20 rounded-full border border-border/60 bg-background/80 p-2 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:text-foreground"
          aria-label="Show invoice quick stats"
        >
          <Info className="h-4 w-4" />
        </button>
      ) : null}
      <AnimatePresence>
        {shouldRenderPopover && (
          <motion.div
            ref={popoverRef}
            id={popoverId}
            role="tooltip"
            aria-describedby={popoverId}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
            }}
            initial={reducedMotion ? false : { opacity: 0, scale: 0.95, y: -4 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -4 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
            className="z-50 w-64 rounded-lg border border-border bg-popover p-4 shadow-lg backdrop-blur-sm pointer-events-none"
          >
          {/* Header */}
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Invoice Preview
            </p>
            <p className="text-sm font-semibold text-foreground line-clamp-1">
              {metadata.invoiceNumber}
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="space-y-3">
            {/* APR */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">APR</span>
              </div>
              <span className="text-sm font-semibold text-primary">
                {formatApr(terms.apr)}
              </span>
            </div>

            {/* Risk Tier */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">Risk</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {riskTier}
              </span>
            </div>

            {/* Jurisdiction */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">Region</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {jurisdictionName}
              </span>
            </div>

            {/* Funded % */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border border-green-500/50 bg-green-500/10 flex-shrink-0 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Funded</span>
              </div>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                {fundedPercent}%
              </span>
            </div>

            {/* Days to Maturity */}
            <div className="flex items-start justify-between pt-1 border-t border-border">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">Maturity</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {daysToMaturity}d
              </span>
            </div>

            {/* Due date */}
            <div className="flex items-start justify-between pt-1 border-t border-border">
              <div className="flex items-center gap-2">
                <CircleAlert className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">Due</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {formatDate(terms.repaymentDate, "short")}
              </span>
            </div>
          </div>

          {/* Footer hint */}
          <p className="mt-3 text-xs text-muted-foreground/70 border-t border-border pt-2">
            {isTouchDevice ? "Tap again to continue" : "Click to view full details"}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
