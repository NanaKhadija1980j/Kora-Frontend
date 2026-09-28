"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useCallback, memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Calendar, Users, TrendingUp, ArrowRight, Clock, GitCompareArrows, Star } from "lucide-react";
import { RiskBadge, Badge } from "@/components/ui/badge";
import { InvoiceFundingProgress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrefetchInvoice } from "@/hooks/usePrefetchInvoice";
import {
  daysUntil,
  cn,
} from "@/lib/utils";
import { useFormatters } from "@/hooks/useFormatters";
import useCountdown from "@/hooks/useCountdown";
import CountdownTimer from "@/components/ui/CountdownTimer";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { DebtorDisplay } from "./DebtorDisplay";
import { getMaskedDebtorName } from "@/lib/debtorPrivacy";
import { InvoiceCardHoverPopover } from "./InvoiceCardHoverPopover";
import { useInvoiceStore } from "@/store/invoiceStore";
import { MAX_COMPARISON_INVOICES } from "@/lib/comparison";
import { useFeatureFlag } from "@/lib/featureFlags";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { StaleDataBadge } from "@/components/layout/StaleDataBadge";
import {
  resolveThumbnailSrc,
  thumbnailBlurDataUri,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
} from "@/lib/invoiceSvg";
import type { Invoice } from "@/types";

interface InvoiceCardProps {
  invoice: Invoice;
  index?: number;
  updatedAt?: number;
  tabIndex?: number;
  onCardKeyDown?: (event: React.KeyboardEvent<HTMLAnchorElement>) => void;
  onCardFocus?: () => void;
  isSelectedForComparison?: boolean;
}

const JURISDICTION_FLAGS: Record<string, string> = {
  KE: "🇰🇪",
  NG: "🇳🇬",
  GH: "🇬🇭",
  ZA: "🇿🇦",
  US: "🇺🇸",
  EU: "🇪🇺",
  UK: "🇬🇧",
  GB: "🇬🇧",
};

// Names are resolved via the "marketplace" translation namespace
// (marketplace.jurisdictionOptions.*) at render time.
const getJurisdictionNames = (t: (key: string) => string): Record<string, string> => ({
  KE: t("jurisdictionOptions.KE"),
  NG: t("jurisdictionOptions.NG"),
  GH: t("jurisdictionOptions.GH"),
  ZA: t("jurisdictionOptions.ZA"),
  US: t("jurisdictionOptions.US"),
  EU: t("jurisdictionOptions.EU"),
  UK: t("jurisdictionOptions.UK"),
});

function getFlagEmoji(countryCode: string) {
  if (JURISDICTION_FLAGS[countryCode]) {
    return JURISDICTION_FLAGS[countryCode];
  }
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

export const InvoiceCard = memo(function InvoiceCard({ invoice, index = 0, updatedAt, tabIndex, onCardKeyDown, onCardFocus, isSelectedForComparison = false }: InvoiceCardProps) {
  const t = useTranslations("invoiceCard");
  const tMarketplace = useTranslations("marketplace");
  const { metadata, terms, funding, riskTier, status, listingExpiry } = invoice;
  const { formatCurrency, formatApr } = useFormatters();
  const days = daysUntil(terms.repaymentDate);
  const flag = getFlagEmoji(metadata.jurisdiction);
  const jurisdictionNames = getJurisdictionNames(tMarketplace);
  const countryName = jurisdictionNames[metadata.jurisdiction] || metadata.jurisdiction;
  const { prefetch: prefetchInvoice, cancelPrefetch } = usePrefetchInvoice();
  const { comparisonList, toggleComparison, toggleWatchedInvoice, isInvoiceWatched } = useInvoiceStore();
  const isInComparison = comparisonList.includes(invoice.id);
  const comparisonFull = comparisonList.length >= MAX_COMPARISON_INVOICES && !isInComparison;
  const comparisonEnabled = useFeatureFlag("comparison");
  const reduced = useReducedMotion();
  const { isOnline } = useNetworkStatus();
  const watched = isInvoiceWatched(invoice.id);

  // Hover popover state
  const [popoverOpen, setPopoverOpen] = useState(false);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Check if invoice is expired
  const countdown = useCountdown(listingExpiry ?? 0);
  const isExpired = countdown.isExpired || status === "cancelled";

  // Preview thumbnail (Issue #438). Resolved from the NFT-standard `image`
  // field; null when the invoice predates thumbnails or the URI is not an
  // allowlisted https/ipfs source. `thumbFailed` covers the runtime case —
  // a gateway 404 or timeout — so a dead CID degrades to the placeholder
  // instead of leaving a broken image in the grid.
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumbnailSrc = resolveThumbnailSrc(metadata.image);
  const blurDataURL = thumbnailBlurDataUri(riskTier);
  const showThumbnail = thumbnailSrc !== null && !thumbFailed;

  const handleMouseEnter = useCallback(() => {
    prefetchInvoice(invoice.id);

    // Delay popover open to avoid flash on quick hovers
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isExpired) {
        setPopoverOpen(true);
      }
    }, 300);
  }, [prefetchInvoice, invoice.id, isExpired]);

  const handleMouseLeave = useCallback(() => {
    cancelPrefetch();
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setPopoverOpen(false);
  }, [cancelPrefetch]);

  const handleFocus = useCallback(() => {
    prefetchInvoice(invoice.id);
    if (!isExpired) {
      setPopoverOpen(true);
    }
  }, [prefetchInvoice, invoice.id, isExpired]);

  const handleBlur = useCallback(() => {
    cancelPrefetch();
    setPopoverOpen(false);
  }, [cancelPrefetch]);

  // Cleanup on unmount
  const handleUnmount = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  }, []);

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!comparisonFull) toggleComparison(invoice.id);
  };

  return (
    <Link
      ref={cardRef}
      href={`/marketplace/${invoice.id}`}
      data-tour={index === 0 ? "invoice-card" : undefined}
      tabIndex={tabIndex}
      onKeyDown={onCardKeyDown}
      onFocusCapture={onCardFocus}
      data-comparison-selected={comparisonEnabled ? String(isSelectedForComparison) : undefined}
      className={cn("block group relative h-full", isExpired && "opacity-60")}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      role="article"
      aria-label={`Invoice for ${getMaskedDebtorName(invoice)}, Amount: ${formatCurrency(metadata.amount, metadata.currency, true)}, Risk Tier: ${riskTier}, APR: ${formatApr(terms.apr)}`}
      aria-describedby={popoverOpen ? `invoice-popover-${invoice.id}` : undefined}
    >
      <motion.div
        layoutId={`invoice-card-${invoice.id}`}
        className={cn(
          "relative overflow-hidden rounded-xl border bg-card/60 p-5 backdrop-blur-sm transition-all duration-200 hover:bg-card hover:shadow-token-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background flex flex-col h-full justify-between",
          isExpired ? "border-muted bg-muted/30 hover:border-muted" : "border-border hover:border-border",
          isSelectedForComparison && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={reduced ? {} : { opacity: 1, y: 0 }}
        whileHover={(!isExpired && !reduced) ? { y: -6 } : {}}
        transition={reduced ? { duration: 0 } : { duration: 0.3, delay: index * 0.05 }}
      >
        <div>
          {/* Preview thumbnail — fixed aspect box so the card never reflows
              when the image lands. Decorative: every fact it conveys is in the
              card text and the wrapper's aria-label, so it stays out of the
              a11y tree rather than repeating them. */}
          <div
            className="relative mb-4 w-full overflow-hidden rounded-lg border border-border/50 bg-muted/30"
            style={{ aspectRatio: `${THUMBNAIL_WIDTH} / ${THUMBNAIL_HEIGHT}` }}
          >
            {showThumbnail ? (
              <Image
                src={thumbnailSrc}
                alt=""
                aria-hidden="true"
                fill
                // Cards sit in a 1/2/3-column grid; without this the browser
                // assumes full viewport width and fetches a needlessly large
                // candidate on mobile.
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                placeholder="blur"
                blurDataURL={blurDataURL}
                // Below the fold in every layout — let the browser defer it so
                // it never competes with the real LCP element.
                loading="lazy"
                onError={() => setThumbFailed(true)}
              />
            ) : (
              <div
                aria-hidden="true"
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url("${blurDataURL}")` }}
              />
            )}
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DebtorDisplay invoice={invoice} className="group-hover:text-primary transition-colors" />
              <p className="mt-1 truncate text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                {metadata.invoiceNumber}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <RiskBadge tier={riskTier} />
                <Badge variant="kora" className="font-semibold px-1.5 py-0.5 text-[10px]">
                  {formatApr(terms.apr)}
                </Badge>
                {isExpired && (
                  <Badge variant="default" className="font-semibold px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground">
                    {t("expired")}
                  </Badge>
                )}
              </div>
              <InvoiceStatusBadge status={status} />
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleWatchedInvoice(invoice.id); }}
            className="absolute right-4 top-4 z-20 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
            aria-label={watched ? `Unstar ${metadata.invoiceNumber}` : `Star ${metadata.invoiceNumber}`}
          >
            <Star className={cn("h-5 w-5", watched && "fill-primary text-primary")} />
          </button>

          {/* Stale-cache badge — only shown when offline and cache timestamp is available */}
          {!isOnline && updatedAt ? (
            <StaleDataBadge updatedAt={updatedAt} compact className="mt-2 w-full justify-center" />
          ) : null}

          {/* Amount */}
          <div className="mt-4">
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(metadata.amount, metadata.currency, true)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("financing", { amount: formatCurrency(terms.financingAmount, metadata.currency, true) })}
            </p>
          </div>

          <div className="mt-4">
            <InvoiceFundingProgress
              funded={funding.totalRaised}
              target={funding.targetAmount}
              currency={metadata.currency}
              updatedAt={updatedAt}
            />
          </div>

          {/* Metrics */}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
            <div>
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-primary" aria-hidden="true" /> {t("aprLabel")}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-primary">
                {formatApr(terms.apr)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3 w-3 text-muted-foreground" aria-hidden="true" /> {t("tenorLabel")}
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {t("tenorDays", { count: terms.tenor })}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3 w-3 text-muted-foreground" aria-hidden="true" /> {t("investorsLabel")}
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {funding.investorCount}
              </p>
            </div>
          </div>

          {/* Time to repayment (#692). Distinct from the listing countdown in
              the footer: that one says when the card leaves the marketplace,
              this one says when the investor gets paid back. Compact so the
              card keeps its height. */}
          {terms.repaymentDate ? (
            <div
              className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4"
              data-testid="invoice-card-maturity"
            >
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                {t("maturityLabel")}
              </span>
              <CountdownTimer
                targetDate={terms.repaymentDate}
                compact
                expiredLabel={t("overdue")}
              />
            </div>
          ) : null}
        </div>

        <div>
          {/* Footer Info */}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <span className="text-sm shrink-0" role="img" aria-label={countryName}>{flag}</span>
              <span className="truncate">{countryName} · {metadata.category}</span>
            </span>
            <span className={cn("text-xs flex items-center gap-1 shrink-0 font-medium", isExpired ? "text-muted-foreground" : "text-muted-foreground")}>
              {isExpired ? (
                <>
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {t("expired")}
                </>
              ) : listingExpiry ? (
                <>
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  <CountdownTimer targetDate={listingExpiry} compact className="ml-1" />
                </>
              ) : null}
            </span>
          </div>

          {!isExpired && (status === "listed" || status === "partially_funded") ? (
            <Button size="sm" className="mt-4 w-full relative z-20" onClick={(e) => e.preventDefault()}>
              {t("fundInvoice")}
            </Button>
          ) : null}

          {/* Compare toggle button */}
          {comparisonEnabled && (
          <button
            onClick={handleCompareToggle}
            disabled={comparisonFull}
            className={cn(
              "mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors relative z-20",
              isInComparison
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                : comparisonFull
                  ? "border-border/30 bg-transparent text-muted-foreground/40 cursor-not-allowed"
                  : "border-border bg-transparent text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            )}
            aria-label={
              isInComparison
                ? t("removeFromCompare", { debtor: getMaskedDebtorName(invoice) })
                : comparisonFull
                  ? t("comparisonFull")
                  : t("addToCompare", { debtor: getMaskedDebtorName(invoice) })
            }
            aria-pressed={isInComparison}
          >
            <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
            {isInComparison ? t("removeFromCompareButton") : t("addToCompareButton")}
          </button>
          )}        </div>

        {/* Hover overlay CTA */}
        <div className="absolute inset-0 bg-zinc-950/75 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex items-center justify-center pointer-events-none">
          <div className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-lg shadow-xl flex items-center gap-2 border border-primary/20 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 pointer-events-auto">
            {t("viewDetails")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        {/* Hover Popover */}
        <InvoiceCardHoverPopover
          invoice={invoice}
          isOpen={popoverOpen}
          onOpenChange={setPopoverOpen}
          triggerRef={cardRef}
          onPrefetch={prefetchInvoice}
        />
      </motion.div>
    </Link>
  );
});

export function InvoiceCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4 relative overflow-hidden flex flex-col justify-between h-full min-h-[320px]">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-2 mt-5">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>

        {/* Progress */}
        <div className="space-y-2 mt-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 border-t border-border pt-4 mt-5">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-8" />
          </div>
        </div>
      </div>

      <div>
        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-4 mt-5">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-9 w-full mt-4" />
      </div>
    </div>
  );
}
