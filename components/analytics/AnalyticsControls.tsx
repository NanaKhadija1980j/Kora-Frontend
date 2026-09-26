"use client";

import { motion } from "framer-motion";
import { Filter, Download, FileText, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DateRange = "7d" | "30d" | "90d" | "all";

interface AnalyticsControlsProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  isLoading?: boolean;
  onExportPortfolio?: () => void;
  onExportYield?: () => void;
  onExportRisk?: () => void;
  onExportMonthly?: () => void;
  onReset?: () => void;
  /**
   * Download the branded PDF portfolio digest (#602).
   *
   * Given its own labelled button rather than another icon in the export row:
   * the digest is a different artefact from the per-chart CSVs — one document
   * covering the whole filtered portfolio — and burying it behind a fifth
   * identical download glyph would make it undiscoverable.
   */
  onDownloadDigest?: () => void;
  /** True while the PDF is being generated, to disable the button. */
  isGeneratingDigest?: boolean;
}

export function AnalyticsControls({
  range,
  onRangeChange,
  isLoading,
  onExportPortfolio,
  onExportYield,
  onExportRisk,
  onExportMonthly,
  onReset,
  onDownloadDigest,
  isGeneratingDigest = false,
}: AnalyticsControlsProps) {
  const t = useTranslations("analytics");
  const ranges: Array<{ value: DateRange; label: string; description: string }> = [
    { value: "7d", label: "7 Days", description: "Last week" },
    { value: "30d", label: "30 Days", description: "Last month" },
    { value: "90d", label: "90 Days", description: "Last quarter" },
    { value: "all", label: "All Time", description: "Since inception" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      {/* Date Range Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Period:</span>
        <div className="flex gap-1.5">
          {ranges.map((r) => (
            <motion.button
              key={r.value}
              type="button"
              onClick={() => onRangeChange(r.value)}
              disabled={isLoading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={r.description}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                range === r.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {r.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Export & Reset Controls */}
      <div className="flex items-center gap-2">
        {onDownloadDigest && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownloadDigest}
            disabled={isLoading || isGeneratingDigest}
            className="gap-1.5"
            aria-label={t("a11y.downloadDigest")}
            title="Download a branded PDF summary of the filtered portfolio"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="text-xs">{isGeneratingDigest ? "Generating…" : "PDF digest"}</span>
          </Button>
        )}

        {onReset && (
          <motion.button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-lg p-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t("a11y.resetFilters")}
            title="Reset to default"
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </motion.button>
        )}

        {/* Export Menu */}
        <div className="hidden gap-1 border-l border-border/50 pl-2 sm:flex">
          {[
            { onClick: onExportPortfolio, label: "Portfolio" },
            { onClick: onExportYield, label: "Yield" },
            { onClick: onExportRisk, label: "Risk" },
            { onClick: onExportMonthly, label: "Returns" },
          ].map(
            (item) =>
              item.onClick && (
                <motion.button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  disabled={isLoading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-lg p-2 text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t("a11y.exportData", { label: item.label })}
                  title={`Download ${item.label} as CSV`}
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </motion.button>
              )
          )}
        </div>
      </div>
    </motion.div>
  );
}
