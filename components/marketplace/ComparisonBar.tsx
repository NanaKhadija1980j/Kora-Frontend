"use client";

/**
 * ComparisonBar — fixed bottom bar showing invoices selected for comparison.
 *
 * Appears when 1+ invoices are in the comparison list. Shows invoice chips
 * with remove buttons and a "Compare" CTA that opens the ComparisonTable.
 * Supports shareable URLs with comparison invoice IDs (?compare=id1,id2,...).
 * Gated behind the "comparison" feature flag.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { X, GitCompareArrows, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInvoiceStore } from "@/store/invoiceStore";
import { cn } from "@/lib/utils";
import { MAX_COMPARISON_INVOICES } from "@/lib/comparison";
import { isEnabled } from "@/lib/featureFlags";
import { getMaskedDebtorName } from "@/lib/debtorPrivacy";
import { ComparisonTable } from "./ComparisonTable";

export function ComparisonBar() {
  const tInvoiceCard = useTranslations("invoiceCard");
  const tMarketplace = useTranslations("marketplace");
  const {
    comparisonList,
    invoices,
    invoicesByTokenId,
    removeFromComparison,
    clearComparison,
    setComparisonList,
  } = useInvoiceStore();
  const [tableOpen, setTableOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydratedFromUrl = useRef(false);

  // ─── Feature flag ────────────────────────────────────────────────────────
  const isComparisonEnabled = isEnabled("comparison");

  // Hydrate comparison list from shareable URL once
  useEffect(() => {
    if (!isComparisonEnabled || hydratedFromUrl.current) return;
    hydratedFromUrl.current = true;

    const compareParam = searchParams.get("compare");
    if (!compareParam) return;

    const ids = compareParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COMPARISON_INVOICES);

    if (ids.length === 0) return;

    setComparisonList(ids);
    if (ids.length >= 2) setTableOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComparisonEnabled]);

  // Keep ?compare= in sync with selection for shareable URLs
  useEffect(() => {
    if (!isComparisonEnabled || !hydratedFromUrl.current) return;

    const params = new URLSearchParams(searchParams.toString());
    const current = params.get("compare") ?? "";
    const next = comparisonList.join(",");

    if (comparisonList.length === 0) {
      if (!params.has("compare")) return;
      params.delete("compare");
    } else if (current === next) {
      return;
    } else {
      params.set("compare", next);
    }

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [comparisonList, isComparisonEnabled, pathname, router, searchParams]);

  if (!isComparisonEnabled) return null;

  // Resolve selected invoices from store list + token map (live indexer shape)
  const invoiceIndex = [
    ...invoices,
    ...Object.values(invoicesByTokenId),
  ];
  const selectedInvoices = comparisonList
    .map((id) => invoiceIndex.find((inv) => inv.id === id || inv.tokenId === id))
    .filter(Boolean) as NonNullable<(typeof invoiceIndex)[number]>[];

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("compare", comparisonList.join(","));
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      router.replace(`${url.pathname}?${url.searchParams.toString()}`, {
        scroll: false,
      });
    }
  };

  if (comparisonList.length === 0) return null;

  // ─── Mobile: show only count + compare button ──────────────────────────
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <>
      <AnimatePresence>
        {tableOpen && selectedInvoices.length >= 2 && (
          <ComparisonTable
            invoices={selectedInvoices}
            onClose={() => setTableOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md shadow-2xl pb-[env(safe-area-inset-bottom)]"
        role="region"
        aria-label={tMarketplace("comparison.barAriaLabel")}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-3">
          <div className="flex shrink-0 items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{tMarketplace("comparison.compare")}</span>
            <span className="text-xs text-muted-foreground">
              ({comparisonList.length}/{MAX_COMPARISON_INVOICES})
            </span>
          </div>

          {/* ─── Mobile: show chips in horizontal scroll ────────────────── */}
          <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-0.5">
            {selectedInvoices.map((invoice) => (
              <motion.div
                key={invoice.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground"
              >
                <span className="max-w-[80px] truncate sm:max-w-[120px]">
                  {getMaskedDebtorName(invoice)}
                </span>
                <span className="text-primary font-semibold">
                  {invoice.terms.apr.toFixed(1)}%
                </span>
                <button
                  onClick={() => removeFromComparison(invoice.id)}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label={tInvoiceCard("removeFromCompare", { debtor: getMaskedDebtorName(invoice) })}
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}

            {/* IDs not yet resolved from live data */}
            {comparisonList
              .filter(
                (id) =>
                  !selectedInvoices.some((inv) => inv.id === id || inv.tokenId === id)
              )
              .map((id) => (
                <div
                  key={id}
                  className="flex shrink-0 items-center rounded-lg border border-dashed border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground"
                >
                  {tMarketplace("comparison.loading", { id: id.slice(0, 8) })}
                </div>
              ))}

            {/* Empty slots - hidden on mobile */}
            {Array.from({
              length: Math.max(0, MAX_COMPARISON_INVOICES - comparisonList.length),
            }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="hidden sm:flex shrink-0 items-center justify-center rounded-lg border border-dashed border-border/50 px-4 py-1.5 text-xs text-muted-foreground/50"
              >
                {tMarketplace("comparison.add")}
              </div>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={tMarketplace("comparison.shareAriaLabel")}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{copied ? tMarketplace("comparison.copied") : tMarketplace("comparison.share")}</span>
            </button>

            {!isMobile && (
              <button
                onClick={clearComparison}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label={tMarketplace("comparison.clearAriaLabel")}
              >
                {tMarketplace("clear")}
              </button>
            )}

            <Button
              size="sm"
              onClick={() => setTableOpen(true)}
              disabled={selectedInvoices.length < 2}
              className={cn(
                "gap-1.5",
                selectedInvoices.length < 2 && "opacity-50 cursor-not-allowed"
              )}
              aria-label={
                selectedInvoices.length < 2
                  ? tMarketplace("comparison.selectAtLeastTwo")
                  : tMarketplace("comparison.openTable")
              }
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              {tMarketplace("comparison.compare")}
              {selectedInvoices.length >= 2 && (
                <span className="ml-0.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-bold">
                  {selectedInvoices.length}
                </span>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}