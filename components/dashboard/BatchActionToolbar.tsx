"use client";

import React from "react";
import {
  XCircle,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Banknote,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { BatchItemStatus, BatchQueueItem } from "@/lib/batch/txQueue";

interface BatchActionToolbarProps {
  selectedCount: number;
  onCancel: () => void;
  onRepay?: () => void;
  onExport: () => void;
  isProcessing?: boolean;
  progress?: number; // 0-100
  processingLabel?: string;
  /** Per-invoice progress rows */
  items?: BatchQueueItem[];
  onResumeFailed?: () => void;
  canRepay?: boolean;
  canCancel?: boolean;
}

function statusColor(status: BatchItemStatus): string {
  switch (status) {
    case "success":
      return "text-emerald-400";
    case "failed":
      return "text-destructive";
    case "processing":
      return "text-primary";
    default:
      return "text-muted-foreground";
  }
}

export function BatchActionToolbar({
  selectedCount,
  onCancel,
  onRepay,
  onExport,
  isProcessing = false,
  progress = 0,
  processingLabel,
  items = [],
  onResumeFailed,
  canRepay = true,
  canCancel = true,
}: BatchActionToolbarProps) {
  const t = useTranslations("batchToolbar");

  if (selectedCount === 0 && !isProcessing && items.length === 0) return null;

  const failedCount = items.filter((i) => i.status === "failed").length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-8 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4"
      >
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xl backdrop-blur-md">
          {isProcessing && (
            <div
              className="absolute bottom-0 left-0 h-1 bg-primary/20 transition-all duration-300"
              style={{ width: `${progress}%` }}
              data-testid="batch-progress-bar"
            />
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  selectedCount || items.length
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isProcessing
                    ? processingLabel ?? t("processing")
                    : t("invoicesSelected", { count: selectedCount })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isProcessing
                    ? t("percentCompleted", { percent: Math.round(progress) })
                    : t("selectBulkActions")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isProcessing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 border-border bg-background hover:bg-muted"
                    onClick={onExport}
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("exportCsv")}</span>
                  </Button>
                  {onRepay && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 gap-2"
                      onClick={onRepay}
                      disabled={!canRepay}
                      data-testid="batch-repay-btn"
                    >
                      <Banknote className="h-4 w-4" />
                      <span>{t("repay")}</span>
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-9 gap-2"
                    onClick={onCancel}
                    disabled={!canCancel}
                    data-testid="batch-cancel-btn"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>{t("cancelInvoices")}</span>
                  </Button>
                  {failedCount > 0 && onResumeFailed && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2"
                      onClick={onResumeFailed}
                      data-testid="batch-resume-btn"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t("retryFailedCount", { count: failedCount })}
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  {t("processing")}
                </div>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <ul
              className="mt-3 max-h-40 space-y-1 overflow-auto rounded-lg border border-border/60 bg-muted/20 p-2"
              data-testid="batch-item-list"
            >
              {items.map((item) => (
                <li
                  key={`${item.action}-${item.id}`}
                  className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-xs"
                  data-status={item.status}
                >
                  <span className="font-mono text-muted-foreground truncate">
                    {item.label}
                  </span>
                  <span className={cn("shrink-0 capitalize", statusColor(item.status))}>
                    {item.status === "processing" ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        processing
                      </span>
                    ) : (
                      item.status
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface BatchResultSummaryProps {
  total: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
  onClose: () => void;
  onResumeFailed?: () => void;
}

export function BatchResultSummary({
  total,
  successCount,
  failedCount,
  errors,
  onClose,
  onResumeFailed,
}: BatchResultSummaryProps) {
  const t = useTranslations("batchToolbar");

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-center gap-8 py-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("resultTotal")}</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-success">{successCount}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("resultSuccess")}</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-destructive">{failedCount}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("resultFailed")}</p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            {t("failureDetails")}
          </p>
          <div className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-2 space-y-1">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start justify-between gap-4 p-2 rounded hover:bg-muted/50 text-xs">
                <span className="font-mono text-muted-foreground shrink-0">{err.id}</span>
                <span className="text-destructive text-right">{err.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-primary/5 border border-primary/10 p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("batchComplete", { success: successCount })}
          {failedCount > 0 && t("batchPartialFail")}
        </p>
      </div>

      <div className="flex gap-2">
        {failedCount > 0 && onResumeFailed && (
          <Button variant="outline" className="flex-1" onClick={onResumeFailed} data-testid="summary-resume-btn">
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("retryFailed")}
          </Button>
        )}
        <Button className="flex-1" onClick={onClose}>
          {t("done")}
        </Button>
      </div>
    </div>
  );
}
