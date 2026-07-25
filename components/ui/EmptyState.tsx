"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

export type EmptyStateVariant =
  | "no-invoices"
  | "no-positions"
  | "no-transactions"
  | "no-results"
  | "marketplace"
  | "sme"
  | "investor"
  | "transactions"
  | "analytics";

type Props = {
  title: string;
  description?: string;
  cta?: { label: string; onClick: () => void } | null;
  variant?: EmptyStateVariant;
  className?: string;
};

const VARIANT_CONFIG: Record<
  EmptyStateVariant,
  { icon: string; heading: string; subtext: string }
> = {
  "no-invoices": {
    icon: "📄",
    heading: "No invoices yet",
    subtext: "Create your first invoice to start raising liquidity on-chain.",
  },
  "no-positions": {
    icon: "📊",
    heading: "No positions yet",
    subtext: "Fund invoices on the marketplace to build your investment portfolio.",
  },
  "no-transactions": {
    icon: "🔄",
    heading: "No transactions yet",
    subtext: "Your on-chain transaction history will appear here.",
  },
  "no-results": {
    icon: "🔍",
    heading: "No results found",
    subtext: "We couldn't find anything matching your current filters. Try resetting.",
  },
  // Legacy variants kept for backward compat
  marketplace: {
    icon: "🏪",
    heading: "No invoices match your filters",
    subtext: "Try adjusting your filters to explore more opportunities.",
  },
  sme: {
    icon: "📄",
    heading: "No invoices yet",
    subtext: "Create your first invoice to start raising liquidity.",
  },
  investor: {
    icon: "📊",
    heading: "No positions yet",
    subtext: "Fund invoices on the marketplace to build your portfolio.",
  },
  transactions: {
    icon: "🔄",
    heading: "No transactions yet",
    subtext: "Your transaction history will appear here.",
  },
  analytics: {
    icon: "📈",
    heading: "No data yet",
    subtext: "Analytics will populate once you have activity.",
  },
};

function Illustration({ variant }: { variant: EmptyStateVariant }) {
  const { icon } = VARIANT_CONFIG[variant];
  return (
    <span className="text-6xl" role="img" aria-hidden="true">
      {icon}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  cta = null,
  variant = "marketplace",
  className = "",
}: Props) {
  const config = VARIANT_CONFIG[variant];
  const displayTitle = title || config.heading;
  const displayDescription = description ?? config.subtext;

  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center ${className}`}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Illustration variant={variant} />
      </motion.div>
      <h3 className="text-lg font-semibold text-foreground">{displayTitle}</h3>
      {displayDescription && (
        <p className="text-sm text-muted-foreground max-w-xl">{displayDescription}</p>
      )}
      {cta && (
        <div className="mt-2">
          <Button onClick={cta.onClick}>{cta.label}</Button>
        </div>
      )}
    </div>
  );
}

export default EmptyState;
