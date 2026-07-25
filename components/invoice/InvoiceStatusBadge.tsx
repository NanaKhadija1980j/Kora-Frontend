"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Activity,
  CheckCircle2,
  Banknote,
  AlertOctagon,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/types";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

interface StatusConfig {
  label: string;
  colorClass: string;
  bgClass: string;
  dotClass: string;
  icon: React.ElementType;
  description: string;
  action: string;
}

const STATUS_MAP: Record<InvoiceStatus | "expired", StatusConfig> = {
  draft: {
    label: "Pending",
    colorClass: "text-zinc-500",
    bgClass: "bg-zinc-500/10 border-zinc-500/20",
    dotClass: "bg-zinc-500",
    icon: Clock,
    description: "Invoice draft is being prepared.",
    action: "Awaiting submission.",
  },
  pending_mint: {
    label: "Pending",
    colorClass: "text-zinc-500",
    bgClass: "bg-zinc-500/10 border-zinc-500/20",
    dotClass: "bg-zinc-500",
    icon: Loader2,
    description: "Invoice is being minted on-chain.",
    action: "Awaiting blockchain confirmation.",
  },
  listed: {
    label: "Active",
    colorClass: "text-teal-500",
    bgClass: "bg-teal-500/10 border-teal-500/20",
    dotClass: "bg-teal-500",
    icon: Activity,
    description: "Invoice is active and accepting funds.",
    action: "Available for investment.",
  },
  partially_funded: {
    label: "Active",
    colorClass: "text-teal-500",
    bgClass: "bg-teal-500/10 border-teal-500/20",
    dotClass: "bg-teal-500",
    icon: Activity,
    description: "Invoice is partially funded and still open.",
    action: "Accepting remaining funds.",
  },
  active: {
    label: "Active",
    colorClass: "text-teal-500",
    bgClass: "bg-teal-500/10 border-teal-500/20",
    dotClass: "bg-teal-500",
    icon: Activity,
    description: "Invoice is currently active.",
    action: "Monitoring for repayment.",
  },
  fully_funded: {
    label: "Funded",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10 border-blue-500/20",
    dotClass: "bg-blue-500",
    icon: Banknote,
    description: "Financing target has been reached.",
    action: "Awaiting final settlement/repayment.",
  },
  repaid: {
    label: "Repaid",
    colorClass: "text-green-500",
    bgClass: "bg-green-500/10 border-green-500/20",
    dotClass: "bg-green-500",
    icon: CheckCircle2,
    description: "Invoice has been fully repaid.",
    action: "Yield distributed to investors.",
  },
  defaulted: {
    label: "Defaulted",
    colorClass: "text-red-500",
    bgClass: "bg-red-500/10 border-red-500/20",
    dotClass: "bg-red-500",
    icon: AlertOctagon,
    description: "Invoice has defaulted on repayment.",
    action: "Recovery process initiated.",
  },
  cancelled: {
    label: "Cancelled",
    colorClass: "text-zinc-500",
    bgClass: "bg-zinc-500/10 border-zinc-500/20",
    dotClass: "bg-zinc-500",
    icon: XCircle,
    description: "Invoice financing was cancelled.",
    action: "No further action.",
  },
  expired: {
    label: "Expired",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10 border-amber-500/20",
    dotClass: "bg-amber-500",
    icon: AlertTriangle,
    description: "Invoice listing has expired.",
    action: "No longer accepting funds.",
  },
};

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  const config = STATUS_MAP[status] || STATUS_MAP.pending_mint;
  const Icon = config.icon;

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <motion.div
            layout
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-colors",
              config.bgClass,
              config.colorClass,
              className
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={status}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1.5"
              >
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                      config.dotClass
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex h-2 w-2 rounded-full",
                      config.dotClass
                    )}
                  />
                </span>
                <Icon className="h-3 w-3" aria-hidden="true" />
                {config.label}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={5}
            className="z-50 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-w-[200px]"
          >
            <div className="space-y-1">
              <p className="font-semibold text-zinc-100">{config.label}</p>
              <p className="text-xs">{config.description}</p>
              <p className="text-xs font-medium text-kora-400 mt-1">
                Next: {config.action}
              </p>
            </div>
            <TooltipPrimitive.Arrow className="fill-zinc-800" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
